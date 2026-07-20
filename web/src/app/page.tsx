"use client";

import { useCallback, useEffect, useState } from "react";
import { getCandidate, listCandidates, uploadResumes } from "@/lib/api";
import type { CandidateDetail, CandidateSummary } from "@/lib/types";
import { Intake } from "@/components/Intake";
import { Pipeline } from "@/components/Pipeline";
import { CandidateDrawer } from "@/components/CandidateDrawer";

export default function HomePage() {
  const [candidates, setCandidates] = useState<CandidateSummary[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CandidateDetail | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await listCandidates();
      setCandidates(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load candidates");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const pending = candidates.some(
      (c) => c.status === "queued" || c.status === "processing"
    );
    if (!pending) return;
    const id = window.setInterval(() => {
      void refresh();
    }, 2500);
    return () => window.clearInterval(id);
  }, [candidates, refresh]);

  useEffect(() => {
    if (!selectedId || !drawerOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getCandidate(selectedId);
        if (!cancelled) setDetail(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load candidate");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, drawerOpen, candidates]);

  async function handleFiles(files: File[]) {
    setUploading(true);
    setError(null);
    try {
      const created = await uploadResumes(files);
      setCandidates((prev) => {
        const map = new Map(prev.map((c) => [c.id, c]));
        created.forEach((c) => map.set(c.id, c));
        return Array.from(map.values());
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function openCandidate(id: string) {
    setSelectedId(id);
    setDrawerOpen(true);
  }

  const showPipeline = candidates.length > 0;

  return (
    <main className="relative z-10">
      {error && (
        <div className="fixed left-4 right-4 top-4 z-[60] border border-[var(--danger)]/40 bg-[var(--ink-2)] px-4 py-3 font-mono text-xs text-[var(--danger)] md:left-auto md:right-6 md:max-w-md">
          {error}
        </div>
      )}

      {!showPipeline ? (
        <Intake onFiles={handleFiles} busy={uploading} />
      ) : (
        <Pipeline
          candidates={candidates}
          selectedId={selectedId}
          onSelect={openCandidate}
          onAddMore={handleFiles}
          uploading={uploading}
        />
      )}

      <CandidateDrawer
        candidate={detail}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </main>
  );
}
