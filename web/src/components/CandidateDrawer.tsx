"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScoreRing } from "./ScoreRing";
import { ChatPanel } from "./ChatPanel";
import type { CandidateDetail, Evaluation } from "@/lib/types";

const CATEGORIES: {
  key: keyof Evaluation["scores"];
  label: string;
}[] = [
  { key: "open_source", label: "Open source" },
  { key: "self_projects", label: "Self projects" },
  { key: "production", label: "Production" },
  { key: "technical_skills", label: "Technical skills" },
  { key: "parse_quality", label: "Parse quality" },
];

type Props = {
  candidate: CandidateDetail | null;
  open: boolean;
  onClose: () => void;
};

export function CandidateDrawer({ candidate, open, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!panelRef.current) return;
    gsap.to(panelRef.current, {
      x: open ? 0 : "105%",
      duration: 0.55,
      ease: "power3.inOut",
    });
  }, [open]);

  const evaluation = candidate?.evaluation;

  return (
    <>
      <button
        type="button"
        aria-label="Close candidate"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 transition ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        ref={panelRef}
        className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-xl translate-x-full flex-col border-l border-[var(--line)] bg-[var(--ink-2)] shadow-[-24px_0_80px_rgba(0,0,0,0.45)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-6 py-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--lime)]">
              Candidate
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold text-[var(--paper)]">
              {candidate?.name ?? candidate?.filename ?? "—"}
            </h2>
            <p className="mt-1 font-mono text-xs text-[var(--mist)]">
              {candidate?.filename}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--mist)] hover:text-[var(--lime)]"
          >
            Close
          </button>
        </header>

        <div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-6">
          {candidate?.status === "completed" && evaluation && (
            <>
              <div className="flex items-center gap-6">
                <ScoreRing
                  score={candidate.overall_score ?? 0}
                  max={candidate.max_score ?? 100}
                />
                <div className="flex-1 space-y-3">
                  {CATEGORIES.map(({ key, label }) => {
                    const cat = evaluation.scores[key];
                    const pct = cat.max ? (cat.score / cat.max) * 100 : 0;
                    return (
                      <div key={key}>
                        <div className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--mist)]">
                          <span>{label}</span>
                          <span>
                            {cat.score}/{cat.max}
                          </span>
                        </div>
                        <div className="h-1.5 bg-[var(--ink-3)]">
                          <div
                            className="h-full bg-[var(--lime)] transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <section>
                <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--lime)]">
                  Strengths
                </h3>
                <ul className="mt-2 space-y-2 text-sm text-[var(--paper)]">
                  {evaluation.key_strengths.map((s) => (
                    <li key={s} className="border-l-2 border-[var(--lime)]/40 pl-3">
                      {s}
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--danger)]">
                  Drawbacks
                </h3>
                <ul className="mt-2 space-y-2 text-sm text-[var(--mist)]">
                  {evaluation.areas_for_improvement.map((s) => (
                    <li key={s} className="border-l-2 border-[var(--danger)]/50 pl-3">
                      {s}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="space-y-3">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--mist)]">
                  Evidence
                </h3>
                {CATEGORIES.map(({ key, label }) => (
                  <p key={key} className="text-sm leading-relaxed text-[var(--mist)]">
                    <span className="text-[var(--paper)]">{label}: </span>
                    {evaluation.scores[key]?.evidence}
                  </p>
                ))}
              </section>

              {candidate.parse_diagnostics &&
                (candidate.parse_diagnostics.suggestions?.length > 0 ||
                  candidate.parse_diagnostics.issues?.length > 0) && (
                  <section>
                    <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--warn)]">
                      Parse diagnostics
                    </h3>
                    {candidate.parse_diagnostics.issues?.length > 0 && (
                      <ul className="mt-2 space-y-1 text-sm text-[var(--mist)]">
                        {candidate.parse_diagnostics.issues.map((issue) => (
                          <li key={issue}>• {issue}</li>
                        ))}
                      </ul>
                    )}
                    {candidate.parse_diagnostics.suggestions?.length > 0 && (
                      <ul className="mt-3 space-y-1 text-sm text-[var(--paper)]">
                        {candidate.parse_diagnostics.suggestions.map((tip) => (
                          <li
                            key={tip}
                            className="border-l-2 border-[var(--warn)]/50 pl-3"
                          >
                            {tip}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )}
            </>
          )}

          {candidate?.status === "failed" && (
            <p className="text-sm text-[var(--danger)]">{candidate.error}</p>
          )}

          <section className="flex min-h-[280px] flex-1 flex-col border-t border-[var(--line)] pt-4">
            <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--lime)]">
              Candidate chat
            </h3>
            <div className="min-h-0 flex-1">
              <ChatPanel
                scope="candidate"
                candidateId={candidate?.id}
                disabled={candidate?.status !== "completed"}
                placeholder="Why is open source low?"
              />
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}
