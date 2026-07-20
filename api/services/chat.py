"""Conversational hiring assistant over evaluation context."""

from __future__ import annotations

import json
from typing import Any, Dict, Generator, Iterable, List, Literal, Optional

from openai import OpenAI
from prompt import DEFAULT_MODEL, OPENAI_API_KEY

ChatScope = Literal["candidate", "global"]


def _client() -> OpenAI:
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY is required for chat")
    return OpenAI(api_key=OPENAI_API_KEY)


def _candidate_system_prompt(candidate: Dict[str, Any]) -> str:
    evaluation = candidate.get("evaluation") or {}
    return f"""You are a sharp technical recruiting assistant for HackerRank internship hiring.
You help recruiters understand a candidate's evaluation with clear, evidence-based answers.

Rules:
- Base answers ONLY on the provided resume text and evaluation JSON.
- Be concise, direct, and fair. Never invent experience.
- Highlight drawbacks and strengths with concrete evidence.
- Prefer bullet points for lists.
- If asked to compare to others and you only have one candidate, say you need global scope.

Candidate name: {candidate.get("name")}
Overall score: {candidate.get("overall_score")}/{candidate.get("max_score")}

EVALUATION JSON:
{json.dumps(evaluation, indent=2)}

RESUME TEXT:
{candidate.get("resume_text") or "(unavailable)"}
"""


def _global_system_prompt(candidates: Iterable[Dict[str, Any]]) -> str:
    summaries = []
    for c in candidates:
        if c.get("status") != "completed":
            continue
        summaries.append(
            {
                "id": c.get("id"),
                "name": c.get("name"),
                "filename": c.get("filename"),
                "overall_score": c.get("overall_score"),
                "max_score": c.get("max_score"),
                "key_strengths": (c.get("evaluation") or {}).get("key_strengths"),
                "areas_for_improvement": (c.get("evaluation") or {}).get(
                    "areas_for_improvement"
                ),
                "scores": (c.get("evaluation") or {}).get("scores"),
            }
        )

    return f"""You are a hiring-desk assistant for HackerRank internship recruiting.
You help recruiters compare and rank candidates across the current pipeline.

Rules:
- Use ONLY the candidate summaries provided.
- Be decisive when comparing, but cite score categories and evidence.
- Call out red flags and relative gaps clearly.
- If data is thin, say so.

PIPELINE CANDIDATES:
{json.dumps(summaries, indent=2)}
"""


def stream_chat(
    *,
    scope: ChatScope,
    messages: List[Dict[str, str]],
    candidate: Optional[Dict[str, Any]] = None,
    pipeline: Optional[List[Dict[str, Any]]] = None,
) -> Generator[str, None, None]:
    if scope == "candidate":
        if not candidate or candidate.get("status") != "completed":
            raise ValueError("Candidate evaluation is not ready for chat")
        system = _candidate_system_prompt(candidate)
    else:
        system = _global_system_prompt(pipeline or [])

    client = _client()
    stream = client.chat.completions.create(
        model=DEFAULT_MODEL,
        temperature=0.3,
        stream=True,
        messages=[{"role": "system", "content": system}, *messages],
    )

    for chunk in stream:
        delta = chunk.choices[0].delta.content if chunk.choices else None
        if delta:
            yield delta
