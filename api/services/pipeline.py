"""Wrap the existing hiring-agent scoring pipeline for the API."""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional, Tuple

from github import fetch_and_display_github_info
from models import EvaluationData, JSONResume
from parse_quality import score_parse_quality
from pdf import PDFHandler
from score import _evaluate_resume, find_profile, is_valid_resume_data
from transform import convert_json_resume_to_text, convert_github_data_to_text

logger = logging.getLogger(__name__)


def compute_overall_score(evaluation: EvaluationData) -> Tuple[float, float]:
    total = 0.0
    max_score = 0.0

    if evaluation.scores:
        for category_data in evaluation.scores.model_dump().values():
            category_score = min(category_data["score"], category_data["max"])
            total += category_score
            max_score += category_data["max"]

    if evaluation.bonus_points:
        total += evaluation.bonus_points.total
    if evaluation.deductions:
        total -= evaluation.deductions.total

    max_possible = max_score + 20
    if total > max_possible:
        total = max_possible

    return total, max_score


def run_evaluation(pdf_path: str) -> Dict[str, Any]:
    """Run extract → GitHub enrich → evaluate and return a structured result."""
    pdf_handler = PDFHandler()
    extraction = pdf_handler.extract_json_from_pdf(pdf_path)
    resume_data: Optional[JSONResume] = extraction.resume
    parse_diagnostics = extraction.diagnostics
    parse_score = score_parse_quality(parse_diagnostics)

    if resume_data is None or not is_valid_resume_data(resume_data):
        raise ValueError(
            "Could not extract usable resume content from PDF. "
            f"Parse quality {parse_score.score}/{parse_score.max}: {parse_score.evidence}"
        )

    github_data: Dict[str, Any] = {}
    profiles = []
    if resume_data.basics:
        profiles = resume_data.basics.profiles or []
    github_profile = find_profile(profiles, "Github")
    if github_profile and github_profile.url:
        try:
            fetched = fetch_and_display_github_info(github_profile.url)
            if isinstance(fetched, dict):
                github_data = fetched
        except Exception as exc:
            logger.warning("GitHub enrichment failed: %s", exc)

    evaluation = _evaluate_resume(
        resume_data,
        github_data or None,
        parse_diagnostics=parse_diagnostics,
        parse_score=parse_score,
    )
    if evaluation is None:
        raise ValueError("Evaluation returned no result")

    overall, max_score = compute_overall_score(evaluation)

    resume_text = convert_json_resume_to_text(resume_data)
    if github_data:
        resume_text += convert_github_data_to_text(github_data)

    name = None
    if resume_data.basics and resume_data.basics.name:
        name = resume_data.basics.name
    else:
        name = os.path.basename(pdf_path).replace(".pdf", "")

    return {
        "name": name,
        "overall_score": overall,
        "max_score": max_score,
        "evaluation": evaluation.model_dump(),
        "resume": resume_data.model_dump(),
        "resume_text": resume_text,
        "github": github_data or None,
        "parse_diagnostics": parse_diagnostics.model_dump(),
    }
