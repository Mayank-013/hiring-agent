"""Deterministic ATS parse-quality scoring from extraction diagnostics."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from models import CategoryScore, JSONResume, ParseDiagnostics

CORE_SECTIONS = ("basics", "work", "education", "skills", "projects", "awards")
PARSE_QUALITY_MAX = 10


def _section_populated(resume: Optional[JSONResume], name: str) -> bool:
    if not resume:
        return False
    value = getattr(resume, name, None)
    if value is None:
        return False
    if isinstance(value, list):
        return len(value) > 0
    if name == "basics":
        return bool(getattr(value, "name", None) or getattr(value, "email", None))
    return True


def build_diagnostics(
    *,
    text_content: Optional[str],
    resume: Optional[JSONResume],
    sections_attempted: List[str],
    sections_succeeded: List[str],
    sections_failed: List[str],
    text_extraction_ok: bool,
    schema_errors: Optional[List[str]] = None,
) -> ParseDiagnostics:
    text_len = len(text_content or "")
    issues: List[str] = []
    suggestions: List[str] = []

    if not text_extraction_ok or text_len == 0:
        issues.append("PDF text extraction failed or returned empty content")
        suggestions.append(
            "Export a text-based PDF (not a scanned image). Avoid locking/protecting the file."
        )
    elif text_len < 400:
        issues.append(f"Extracted text is very short ({text_len} chars)")
        suggestions.append(
            "Avoid image-only or heavily designed resumes; use selectable text."
        )

    for section in sections_failed:
        issues.append(f"Failed to parse '{section}' section")
        suggestions.append(
            f"Make the {section} section clearly labeled with plain headings and simple layout."
        )

    for section in CORE_SECTIONS:
        if section in sections_failed:
            continue
        if not _section_populated(resume, section):
            issues.append(f"Section '{section}' is empty or incomplete after parsing")
            suggestions.append(
                f"Ensure {section} content is present as real text (not icons-only) under a clear heading."
            )

    if resume and resume.basics:
        profiles = resume.basics.profiles or []
        has_url = bool(resume.basics.url) or any(
            p and p.url for p in profiles
        )
        if not has_url:
            issues.append("No portfolio/GitHub URL found in structured basics/profiles")
            suggestions.append(
                "Add an explicit GitHub or portfolio URL in the header or links section."
            )

    # Heuristic: dense multi-column / broken markdown often yields many pipe/odd artifacts
    if text_content and text_len > 400:
        weird_ratio = sum(
            text_content.count(ch) for ch in ("|", "�", "□", "■")
        ) / text_len
        if weird_ratio > 0.02:
            issues.append("Extracted text shows layout artifacts (columns/tables/glyphs)")
            suggestions.append(
                "Prefer a single-column layout; avoid complex tables and text boxes."
            )

    # Deduplicate suggestions while preserving order
    seen = set()
    unique_suggestions: List[str] = []
    for s in suggestions:
        if s not in seen:
            seen.add(s)
            unique_suggestions.append(s)

    return ParseDiagnostics(
        text_extraction_ok=text_extraction_ok,
        text_length=text_len,
        sections_attempted=list(sections_attempted),
        sections_succeeded=list(sections_succeeded),
        sections_failed=list(sections_failed),
        schema_errors=list(schema_errors or []),
        issues=issues,
        suggestions=unique_suggestions[:8],
    )


def score_parse_quality(diagnostics: ParseDiagnostics) -> CategoryScore:
    """Compute 0-10 parse_quality from diagnostics."""
    score = float(PARSE_QUALITY_MAX)

    if not diagnostics.text_extraction_ok or diagnostics.text_length == 0:
        return CategoryScore(
            score=0,
            max=PARSE_QUALITY_MAX,
            evidence="PDF text could not be extracted; resume is not machine-readable.",
        )

    # Text length bands
    if diagnostics.text_length < 400:
        score -= 4
    elif diagnostics.text_length < 800:
        score -= 2

    # Failed sections: -1.5 each (heavy)
    score -= 1.5 * len(diagnostics.sections_failed)

    # Empty-but-succeeded / incomplete sections reflected in issues
    empty_issues = [
        i for i in diagnostics.issues if "empty or incomplete" in i.lower()
    ]
    score -= 1.0 * len(empty_issues)

    # Schema errors
    score -= 1.0 * min(len(diagnostics.schema_errors), 3)

    # Layout artifacts
    if any("layout artifacts" in i.lower() for i in diagnostics.issues):
        score -= 1.5

    # Missing profile URL
    if any("No portfolio/GitHub URL" in i for i in diagnostics.issues):
        score -= 0.5

    score = max(0.0, min(float(PARSE_QUALITY_MAX), round(score, 1)))

    succeeded = len(diagnostics.sections_succeeded)
    attempted = len(diagnostics.sections_attempted) or 1
    evidence_parts = [
        f"Parsed {succeeded}/{attempted} sections successfully",
        f"extracted {diagnostics.text_length} characters",
    ]
    if diagnostics.sections_failed:
        evidence_parts.append(
            "failed sections: " + ", ".join(diagnostics.sections_failed)
        )
    if diagnostics.issues:
        evidence_parts.append("issues: " + "; ".join(diagnostics.issues[:3]))
    if diagnostics.suggestions:
        evidence_parts.append(
            "suggestions: " + "; ".join(diagnostics.suggestions[:3])
        )

    return CategoryScore(
        score=score,
        max=PARSE_QUALITY_MAX,
        evidence=". ".join(evidence_parts) + ".",
    )


def format_diagnostics_for_prompt(diagnostics: ParseDiagnostics, score: CategoryScore) -> str:
    return (
        "\n\n=== PARSE QUALITY DIAGNOSTICS (AUTHORITATIVE) ===\n"
        f"Precomputed parse_quality score: {score.score}/{score.max}\n"
        f"Text extraction ok: {diagnostics.text_extraction_ok}\n"
        f"Text length: {diagnostics.text_length}\n"
        f"Sections succeeded: {', '.join(diagnostics.sections_succeeded) or 'none'}\n"
        f"Sections failed: {', '.join(diagnostics.sections_failed) or 'none'}\n"
        f"Issues: {'; '.join(diagnostics.issues) or 'none'}\n"
        f"Suggestions: {'; '.join(diagnostics.suggestions) or 'none'}\n"
        "You MUST set scores.parse_quality to this precomputed score and max. "
        "Use the diagnostics for evidence and include parse/format suggestions in "
        "areas_for_improvement when relevant.\n"
        "=== END PARSE QUALITY DIAGNOSTICS ===\n"
    )


def apply_parse_quality(
    evaluation_dict: Dict[str, Any], score: CategoryScore
) -> Dict[str, Any]:
    """Force parse_quality onto evaluation JSON (authoritative override)."""
    scores = evaluation_dict.setdefault("scores", {})
    scores["parse_quality"] = score.model_dump()
    return evaluation_dict


def diagnostics_from_resume(
    resume: Optional[JSONResume], *, text_length: int = 0
) -> Tuple[ParseDiagnostics, CategoryScore]:
    """Rebuild diagnostics when loading a cached resume (no live extraction)."""
    succeeded = [s for s in CORE_SECTIONS if _section_populated(resume, s)]
    failed = [s for s in CORE_SECTIONS if s not in succeeded]
    # Use a neutral placeholder so short-text penalties don't apply when unknown
    effective_len = text_length if text_length > 0 else 2000
    diagnostics = build_diagnostics(
        text_content="plain resume text " * (effective_len // 16 + 1),
        resume=resume,
        sections_attempted=list(CORE_SECTIONS),
        sections_succeeded=succeeded,
        sections_failed=failed,
        text_extraction_ok=True,
    )
    diagnostics.text_length = effective_len
    return diagnostics, score_parse_quality(diagnostics)
