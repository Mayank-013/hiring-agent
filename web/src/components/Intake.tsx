"use client";

import { DragEvent, useEffect, useId, useRef, useState } from "react";
import gsap from "gsap";

type Props = {
  onFiles: (files: File[]) => void;
  busy?: boolean;
};

export function Intake({ onFiles, busy }: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!rootRef.current) return;
    const ctx = gsap.context(() => {
      const targets = rootRef.current!.querySelectorAll<HTMLElement>("[data-intake]");
      gsap.set(targets, { clearProps: "all" });
      gsap.fromTo(
        targets,
        { y: 28, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.75,
          stagger: 0.12,
          ease: "power3.out",
          clearProps: "transform",
        }
      );
    }, rootRef);
    return () => ctx.revert();
  }, []);

  function takeFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const pdfs = Array.from(fileList).filter((f) =>
      f.name.toLowerCase().endsWith(".pdf")
    );
    if (pdfs.length) onFiles(pdfs);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    takeFiles(e.dataTransfer.files);
  }

  return (
    <section
      ref={rootRef}
      className="relative flex min-h-[100dvh] flex-col justify-center px-6 py-16 md:px-12 lg:px-20"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-24 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(200,245,66,0.18),transparent_65%)] blur-2xl" />
        <div className="absolute bottom-0 right-0 h-[50vh] w-[55vw] bg-[linear-gradient(135deg,transparent_30%,rgba(200,245,66,0.05)_100%)]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-4xl">
        <p
          data-intake
          className="font-mono text-xs uppercase tracking-[0.35em] text-[var(--lime)]"
        >
          HackerRank ATS
        </p>
        <h1
          data-intake
          className="mt-4 font-display text-[clamp(2.75rem,8vw,5.5rem)] font-extrabold leading-[0.92] tracking-tight text-[var(--paper)]"
        >
          Signal
          <br />
          over noise.
        </h1>
        <p
          data-intake
          className="mt-5 max-w-xl text-base text-[var(--mist)] md:text-lg"
        >
          Drop internship resumes. Rank on open source, projects, production, skills,
          and parse quality — then dig in with a hiring desk that cites evidence.
        </p>

        <div data-intake className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="font-display bg-[var(--lime)] px-6 py-3 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--lime-dim)] disabled:opacity-50"
          >
            {busy ? "Uploading…" : "Upload PDFs"}
          </button>
          <span className="font-mono text-xs text-[var(--mist)]">
            or drag files into the zone below
          </span>
        </div>

        <div
          data-intake
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`mt-6 flex min-h-[160px] cursor-pointer flex-col items-start justify-between border border-dashed px-6 py-6 transition md:min-h-[180px] md:px-8 ${
            dragging
              ? "border-[var(--lime)] bg-[rgba(200,245,66,0.08)]"
              : "border-[var(--line)] bg-[rgba(14,18,14,0.55)] hover:border-[var(--lime)]/60"
          } ${busy ? "pointer-events-none opacity-60" : ""}`}
        >
          <span className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--mist)]">
            PDF upload
          </span>
          <div>
            <p className="font-display text-2xl font-semibold text-[var(--paper)] md:text-3xl">
              {busy ? "Queuing evaluations…" : "Drop resumes here"}
            </p>
            <p className="mt-2 text-sm text-[var(--mist)]">
              Click anywhere in this area to browse — batch upload supported
            </p>
          </div>
        </div>

        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            takeFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </section>
  );
}
