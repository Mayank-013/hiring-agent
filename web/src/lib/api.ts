import type { CandidateDetail, CandidateSummary, ChatMessage, ChatScope } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function listCandidates(): Promise<CandidateSummary[]> {
  const data = await parseJson<{ candidates: CandidateSummary[] }>(
    await fetch(`${API_BASE}/api/candidates`, { cache: "no-store" })
  );
  return data.candidates;
}

export async function getCandidate(id: string): Promise<CandidateDetail> {
  return parseJson<CandidateDetail>(
    await fetch(`${API_BASE}/api/candidates/${id}`, { cache: "no-store" })
  );
}

export async function uploadResumes(files: File[]): Promise<CandidateSummary[]> {
  const form = new FormData();
  files.forEach((file) => form.append("files", file));
  const data = await parseJson<{ candidates: CandidateSummary[] }>(
    await fetch(`${API_BASE}/api/resumes`, {
      method: "POST",
      body: form,
    })
  );
  return data.candidates;
}

export async function streamChat(params: {
  scope: ChatScope;
  candidateId?: string;
  messages: ChatMessage[];
  onToken: (token: string) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scope: params.scope,
      candidate_id: params.candidateId,
      messages: params.messages,
    }),
    signal: params.signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text();
    throw new Error(text || "Chat request failed");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const line = part
        .split("\n")
        .find((l) => l.startsWith("data: "));
      if (!line) continue;
      const payload = JSON.parse(line.slice(6)) as {
        token?: string;
        done?: boolean;
        error?: string;
      };
      if (payload.error) throw new Error(payload.error);
      if (payload.token) params.onToken(payload.token);
    }
  }
}
