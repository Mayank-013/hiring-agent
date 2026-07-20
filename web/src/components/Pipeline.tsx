"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ChatPanel } from "./ChatPanel";
import type { CandidateSummary } from "@/lib/types";

type Props = {
  candidates: CandidateSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddMore: (files: File[]) => void;
  uploading?: boolean;
};

function statusLabel(status: CandidateSummary["status"]) {
  switch (status) {
    case "queued":
      return "Queued";
    case "processing":
      return "Scoring";
    case "completed":
      return "Ready";
    case "failed":
      return "Failed";
  }
}

export function Pipeline({
  candidates,
  selectedId,
  onSelect,
  onAddMore,
  uploading,
}: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    gsap.fromTo(
      rootRef.current,
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: 0.6, ease: "power2.out" }
    );
  }, []);

  useEffect(() => {
    if (!listRef.current) return;
    const rows = listRef.current.querySelectorAll(".candidate-row");
    gsap.fromTo(
      rows,
      { y: 12, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.35, stagger: 0.05, ease: "power2.out" }
    );
  }, [candidates.map((c) => `${c.id}:${c.status}:${c.overall_score}`).join("|")]);

  const completed = candidates.filter((c) => c.status === "completed").length;

  return (
    <section ref={rootRef} className="min-h-[100dvh] px-4 py-6 md:px-8 lg:px-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line)] pb-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--lime)]">
            HackerRank ATS
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight md:text-5xl">
            Pipeline
          </h1>
          <p className="mt-2 font-mono text-xs text-[var(--mist)]">
            {completed}/{candidates.length} scored
          </p>
        </div>
        <label className="cursor-pointer border border-[var(--line)] px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-[var(--paper)] transition hover:border-[var(--lime)] hover:text-[var(--lime)]">
          {uploading ? "Uploading…" : "+ Add PDFs"}
          <input
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              if (e.target.files?.length) {
                onAddMore(Array.from(e.target.files));
                e.target.value = "";
              }
            }}
          />
        </label>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-8">
        <div ref={listRef} className="space-y-2">
          {candidates.length === 0 && (
            <p className="text-[var(--mist)]">No candidates yet.</p>
          )}
          {candidates.map((c, index) => {
            const active = c.id === selectedId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c.id)}
                className={`candidate-row flex w-full items-center gap-4 border px-4 py-4 text-left transition ${
                  active
                    ? "border-[var(--lime)] bg-[rgba(200,245,66,0.06)]"
                    : "border-[var(--line)] bg-[rgba(14,18,14,0.4)] hover:border-[var(--lime)]/40"
                }`}
              >
                <span className="font-mono text-xs text-[var(--mist)] w-6">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-semibold text-[var(--paper)]">
                    {c.name ?? c.filename}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--mist)]">
                    <span
                      className={
                        c.status === "processing" || c.status === "queued"
                          ? "animate-pulse-soft text-[var(--warn)]"
                          : c.status === "failed"
                            ? "text-[var(--danger)]"
                            : "text-[var(--lime)]"
                      }
                    >
                      {statusLabel(c.status)}
                    </span>
                    {c.areas_for_improvement?.[0]
                      ? ` · ${c.areas_for_improvement[0]}`
                      : ""}
                  </p>
                </div>
                <div className="text-right">
                  {c.overall_score != null ? (
                    <>
                      <p className="font-display text-2xl font-bold text-[var(--lime)]">
                        {c.overall_score.toFixed(0)}
                      </p>
                      <p className="font-mono text-[10px] text-[var(--mist)]">
                        / {c.max_score}
                      </p>
                    </>
                  ) : (
                    <p className="font-mono text-xs text-[var(--mist)]">—</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex min-h-[420px] flex-col border border-[var(--line)] bg-[rgba(14,18,14,0.55)] p-5 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-6rem)]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Hiring desk</h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--lime)]">
              Global
            </span>
          </div>
          <div className="min-h-0 flex-1">
            <ChatPanel
              scope="global"
              disabled={completed === 0}
              placeholder="Who should we advance?"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
