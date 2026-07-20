"""ATS API — upload resumes, evaluate, and chat with the hiring desk."""

from __future__ import annotations

import json
import logging
import shutil
import sys
from pathlib import Path
from typing import List, Literal, Optional

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

# Ensure project root is on path when running as `uvicorn api.main:app`
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from api.services.chat import stream_chat
from api.services.pipeline import run_evaluation
from api.store import store

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

UPLOAD_DIR = ROOT / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI(title="HackerRank ATS API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    scope: Literal["candidate", "global"] = "global"
    candidate_id: Optional[str] = None
    messages: List[ChatMessage] = Field(default_factory=list)


def _process_candidate(candidate_id: str) -> None:
    candidate = store.get(candidate_id)
    if not candidate or not candidate.pdf_path:
        return

    store.update(candidate_id, status="processing")
    try:
        result = run_evaluation(candidate.pdf_path)
        store.update(
            candidate_id,
            status="completed",
            name=result["name"],
            overall_score=result["overall_score"],
            max_score=result["max_score"],
            evaluation=result["evaluation"],
            resume=result["resume"],
            resume_text=result["resume_text"],
            github=result["github"],
            parse_diagnostics=result.get("parse_diagnostics"),
            error=None,
        )
        logger.info(
            "Completed %s → %.1f/%s",
            result["name"],
            result["overall_score"],
            result["max_score"],
        )
    except Exception as exc:
        logger.exception("Evaluation failed for %s", candidate_id)
        store.update(candidate_id, status="failed", error=str(exc))


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/api/candidates")
def list_candidates():
    return {"candidates": [c.to_summary() for c in store.list()]}


@app.get("/api/candidates/{candidate_id}")
def get_candidate(candidate_id: str):
    candidate = store.get(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate.to_detail()


@app.post("/api/resumes")
async def upload_resumes(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
):
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    created = []
    for upload in files:
        filename = upload.filename or "resume.pdf"
        if not filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=400, detail=f"Only PDF files are supported: {filename}"
            )

        candidate = store.create(filename=filename, pdf_path="")
        dest = UPLOAD_DIR / f"{candidate.id}.pdf"
        with dest.open("wb") as out:
            shutil.copyfileobj(upload.file, out)

        store.update(candidate.id, pdf_path=str(dest))
        background_tasks.add_task(_process_candidate, candidate.id)
        created.append(store.get(candidate.id).to_summary())

    return {"candidates": created}


@app.post("/api/chat")
async def chat(request: ChatRequest):
    if not request.messages:
        raise HTTPException(status_code=400, detail="messages required")

    payload_messages = [m.model_dump() for m in request.messages]

    if request.scope == "candidate":
        if not request.candidate_id:
            raise HTTPException(
                status_code=400, detail="candidate_id required for candidate chat"
            )
        candidate = store.get(request.candidate_id)
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")
        context = {
            "name": candidate.name,
            "status": candidate.status,
            "overall_score": candidate.overall_score,
            "max_score": candidate.max_score,
            "evaluation": candidate.evaluation,
            "resume_text": candidate.resume_text,
        }
        pipeline = None
    else:
        context = None
        pipeline = [
            {
                "id": c.id,
                "name": c.name,
                "filename": c.filename,
                "status": c.status,
                "overall_score": c.overall_score,
                "max_score": c.max_score,
                "evaluation": c.evaluation,
            }
            for c in store.list()
        ]

    def event_stream():
        try:
            for token in stream_chat(
                scope=request.scope,
                messages=payload_messages,
                candidate=context,
                pipeline=pipeline,
            ):
                yield f"data: {json.dumps({'token': token})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.delete("/api/candidates")
def clear_candidates():
    """Clear in-memory pipeline (keeps uploaded files on disk)."""
    with store._lock:
        store._candidates.clear()
    return {"ok": True}
