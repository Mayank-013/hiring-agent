"""In-memory candidate store for the ATS API."""

from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional


Status = Literal["queued", "processing", "completed", "failed"]


@dataclass
class Candidate:
    id: str
    filename: str
    status: Status = "queued"
    name: Optional[str] = None
    error: Optional[str] = None
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    overall_score: Optional[float] = None
    max_score: Optional[float] = None
    evaluation: Optional[Dict[str, Any]] = None
    resume: Optional[Dict[str, Any]] = None
    resume_text: Optional[str] = None
    github: Optional[Dict[str, Any]] = None
    parse_diagnostics: Optional[Dict[str, Any]] = None
    pdf_path: Optional[str] = None

    def touch(self) -> None:
        self.updated_at = datetime.now(timezone.utc).isoformat()

    def to_summary(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "filename": self.filename,
            "status": self.status,
            "name": self.name,
            "error": self.error,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "overall_score": self.overall_score,
            "max_score": self.max_score,
            "key_strengths": (
                self.evaluation.get("key_strengths") if self.evaluation else None
            ),
            "areas_for_improvement": (
                self.evaluation.get("areas_for_improvement")
                if self.evaluation
                else None
            ),
        }

    def to_detail(self) -> Dict[str, Any]:
        return {
            **self.to_summary(),
            "evaluation": self.evaluation,
            "resume": self.resume,
            "github": self.github,
            "parse_diagnostics": self.parse_diagnostics,
        }


class CandidateStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._candidates: Dict[str, Candidate] = {}

    def create(self, filename: str, pdf_path: str) -> Candidate:
        candidate = Candidate(
            id=str(uuid.uuid4()),
            filename=filename,
            pdf_path=pdf_path,
            status="queued",
        )
        with self._lock:
            self._candidates[candidate.id] = candidate
        return candidate

    def get(self, candidate_id: str) -> Optional[Candidate]:
        with self._lock:
            return self._candidates.get(candidate_id)

    def list(self) -> List[Candidate]:
        with self._lock:
            items = list(self._candidates.values())
        items.sort(
            key=lambda c: (
                c.overall_score is None,
                -(c.overall_score or 0),
                c.created_at,
            )
        )
        return items

    def update(self, candidate_id: str, **kwargs: Any) -> Optional[Candidate]:
        with self._lock:
            candidate = self._candidates.get(candidate_id)
            if not candidate:
                return None
            for key, value in kwargs.items():
                setattr(candidate, key, value)
            candidate.touch()
            return candidate


store = CandidateStore()
