"use client";

import { useMemo, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import type { AnalyzeResult, ImportRowResult, LaneState, ReviewRow } from "@/types";
import { BULK_IMPORT_CONCURRENCY } from "@/lib/constants";
import { runPool } from "@/lib/pool";
import { getAudioFilesFromDataTransfer, filterAudioFiles } from "@/lib/read-dropped-files";
import { useAuth } from "@/lib/auth-context";

type Phase = "select" | "analyzing" | "review" | "importing" | "done";

function idleLanes(): LaneState[] {
  return Array.from({ length: BULK_IMPORT_CONCURRENCY }, () => ({ status: "idle" }));
}

function setLane(lanes: LaneState[], index: number, state: LaneState): LaneState[] {
  const copy = [...lanes];
  copy[index] = state;
  return copy;
}

export function BulkImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const { authorizedFetch } = useAuth();
  const [phase, setPhase] = useState<Phase>("select");
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [lanes, setLanes] = useState<LaneState[]>(idleLanes());
  const [paused, setPaused] = useState(false);
  const [reviewFilter, setReviewFilter] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const filesRef = useRef<Map<string, File>>(new Map());
  const inflightRef = useRef<Map<string, AbortController>>(new Map());
  const pausedRef = useRef(false);
  const cancelledRef = useRef(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const updateRow = (clientId: string, patch: Partial<ReviewRow>) => {
    setRows((prev) => prev.map((r) => (r.clientId === clientId ? { ...r, ...patch } : r)));
  };

  const addFiles = (incoming: File[]) => {
    const audio = filterAudioFiles(incoming);
    const newRows: ReviewRow[] = audio.map((f) => {
      const clientId = crypto.randomUUID();
      filesRef.current.set(clientId, f);
      return { clientId, fileName: f.name, fileSize: f.size, status: "pending", title: "", artist: "" };
    });
    setRows((prev) => [...prev, ...newRows]);
  };

  const setPausedBoth = (v: boolean) => {
    pausedRef.current = v;
    setPaused(v);
  };

  async function analyzeRow(row: ReviewRow, laneIndex: number) {
    updateRow(row.clientId, { status: "analyzing" });
    setLanes((prev) => setLane(prev, laneIndex, { status: "working", fileName: row.fileName, stage: "Uploading…" }));

    const file = filesRef.current.get(row.clientId);
    if (!file) {
      updateRow(row.clientId, { status: "error", errorMessage: "File no longer available" });
      setLanes((prev) => setLane(prev, laneIndex, { status: "error", fileName: row.fileName, message: "File no longer available" }));
      return;
    }

    const controller = new AbortController();
    inflightRef.current.set(row.clientId, controller);
    let stagedUrl: string | null = null;
    try {
      // Upload straight from the browser to Blob storage — bypasses this
      // (or any) serverless function's request-body size cap, which real
      // audio files routinely exceed.
      const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
      const blob = await upload(`staging/${crypto.randomUUID()}${ext}`, file, {
        access: "public",
        handleUploadUrl: "/api/blob-upload",
        multipart: true,
        abortSignal: controller.signal,
      });
      stagedUrl = blob.url;

      setLanes((prev) => setLane(prev, laneIndex, { status: "working", fileName: row.fileName, stage: "Analyzing…" }));

      const res = await authorizedFetch("/api/songs/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stagingUrl: blob.url, fileName: file.name }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to analyze file");
      }
      const data: AnalyzeResult = await res.json();
      updateRow(row.clientId, {
        status: "ready",
        stagingId: data.stagingId,
        title: data.title,
        artist: data.artist ?? "",
        titleSource: data.titleSource,
        duration: data.duration,
        suggestedStart: data.suggestedStart,
        startOverride: Math.round(data.suggestedStart * 10) / 10,
      });
      setLanes((prev) => setLane(prev, laneIndex, { status: "done", fileName: row.fileName }));
    } catch (err) {
      if (controller.signal.aborted) {
        updateRow(row.clientId, { status: "pending" });
      } else {
        const message = err instanceof Error ? err.message : "Failed to analyze file";
        updateRow(row.clientId, { status: "error", errorMessage: message });
        setLanes((prev) => setLane(prev, laneIndex, { status: "error", fileName: row.fileName, message }));
        // The upload itself may have succeeded even though analysis failed —
        // don't leave an orphaned blob behind.
        if (stagedUrl) fetch(`/api/songs/analyze?stagingId=${encodeURIComponent(stagedUrl)}`, { method: "DELETE" }).catch(() => {});
      }
    } finally {
      inflightRef.current.delete(row.clientId);
    }
  }

  async function importRow(row: ReviewRow, laneIndex: number) {
    updateRow(row.clientId, { status: "importing" });
    setLanes((prev) => setLane(prev, laneIndex, { status: "working", fileName: row.fileName, stage: "Trimming & encoding…" }));

    const controller = new AbortController();
    inflightRef.current.set(row.clientId, controller);
    try {
      const res = await authorizedFetch("/api/songs/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stagingId: row.stagingId,
          title: row.title,
          artist: row.artist || null,
          startTime: row.startOverride ?? row.suggestedStart ?? 0,
        }),
        signal: controller.signal,
      });
      const data: ImportRowResult = await res.json();
      if (data.status === "imported") {
        updateRow(row.clientId, { status: "imported" });
        setLanes((prev) => setLane(prev, laneIndex, { status: "done", fileName: row.fileName }));
      } else if (data.status === "skipped") {
        updateRow(row.clientId, { status: "skipped" });
        setLanes((prev) => setLane(prev, laneIndex, { status: "done", fileName: row.fileName }));
      } else {
        updateRow(row.clientId, { status: "error", errorMessage: data.reason });
        setLanes((prev) => setLane(prev, laneIndex, { status: "error", fileName: row.fileName, message: data.reason }));
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        const message = err instanceof Error ? err.message : "Import failed";
        updateRow(row.clientId, { status: "error", errorMessage: message });
        setLanes((prev) => setLane(prev, laneIndex, { status: "error", fileName: row.fileName, message }));
      }
    } finally {
      inflightRef.current.delete(row.clientId);
    }
  }

  const startAnalysis = async () => {
    const pending = rows.filter((r) => r.status === "pending");
    if (pending.length === 0) return;
    setPhase("analyzing");
    cancelledRef.current = false;
    setPausedBoth(false);
    await runPool(pending, BULK_IMPORT_CONCURRENCY, (row, _i, laneIndex) => analyzeRow(row, laneIndex), {
      isPaused: () => pausedRef.current,
      isCancelled: () => cancelledRef.current,
    });
    setLanes(idleLanes());
    if (!cancelledRef.current) setPhase("review");
    else setPhase(rows.some((r) => r.status !== "pending") ? "review" : "select");
  };

  const retryFailed = async () => {
    const failed = rows.filter((r) => r.status === "error" && filesRef.current.has(r.clientId));
    if (failed.length === 0) return;
    setPhase("analyzing");
    cancelledRef.current = false;
    setPausedBoth(false);
    await runPool(failed, BULK_IMPORT_CONCURRENCY, (row, _i, laneIndex) => analyzeRow(row, laneIndex), {
      isPaused: () => pausedRef.current,
      isCancelled: () => cancelledRef.current,
    });
    setLanes(idleLanes());
    setPhase("review");
  };

  const startImport = async () => {
    const ready = rows.filter((r) => r.status === "ready");
    if (ready.length === 0) return;
    setPhase("importing");
    cancelledRef.current = false;
    setPausedBoth(false);
    await runPool(ready, BULK_IMPORT_CONCURRENCY, (row, _i, laneIndex) => importRow(row, laneIndex), {
      isPaused: () => pausedRef.current,
      isCancelled: () => cancelledRef.current,
    });
    setLanes(idleLanes());
    setPhase("done");
    onImported();
  };

  const cancelRun = () => {
    cancelledRef.current = true;
    for (const c of inflightRef.current.values()) c.abort();
  };

  const removeRow = (row: ReviewRow) => {
    setRows((prev) => prev.filter((r) => r.clientId !== row.clientId));
    filesRef.current.delete(row.clientId);
    if (row.stagingId) {
      fetch(`/api/songs/analyze?stagingId=${encodeURIComponent(row.stagingId)}`, { method: "DELETE" }).catch(() => {});
    }
  };

  const handleClose = () => {
    if (phase === "analyzing" || phase === "importing") cancelRun();
    for (const row of rows) {
      if (row.stagingId && row.status !== "imported" && row.status !== "skipped") {
        fetch(`/api/songs/analyze?stagingId=${encodeURIComponent(row.stagingId)}`, { method: "DELETE" }).catch(() => {});
      }
    }
    onClose();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = await getAudioFilesFromDataTransfer(e.dataTransfer);
    addFiles(files);
  };

  const processed = rows.filter((r) => !["pending", "analyzing", "importing"].includes(r.status)).length;
  const activeTotal =
    phase === "importing" ? rows.filter((r) => r.status === "ready" || r.status === "importing" || r.status === "imported" || r.status === "skipped").length : rows.length;
  const progressPct = activeTotal === 0 ? 0 : Math.round((processed / activeTotal) * 100);

  const readyCount = rows.filter((r) => r.status === "ready").length;
  const errorCount = rows.filter((r) => r.status === "error").length;
  const importedCount = rows.filter((r) => r.status === "imported").length;
  const skippedCount = rows.filter((r) => r.status === "skipped").length;

  const visibleRows = useMemo(() => {
    const q = reviewFilter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.fileName.toLowerCase().includes(q) || r.title.toLowerCase().includes(q) || r.artist.toLowerCase().includes(q)
    );
  }, [rows, reviewFilter]);

  return (
    <div className="animate-backdrop-in fixed inset-0 z-[9998] flex items-start justify-center overflow-y-auto bg-black/75 p-3 py-8 sm:p-6">
      <div className="animate-scale-in w-full max-w-3xl rounded-3xl border border-line bg-surface p-5 shadow-lg shadow-black/20 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">Bulk import</h2>
            <p className="mt-1 text-xs text-ink-mute">
              Clip start times are auto-picked with a loudness heuristic (loudest ~9s stretch, minus a lead-in) —
              a stand-in for real chorus detection, not the real thing. Adjust any start time before importing.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1.5 text-ink-mute hover:bg-surface-3 hover:text-ink"
          >
            <CloseIcon />
          </button>
        </div>

        {phase === "select" && (
          <div className="mt-5">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition ${
                dragOver ? "border-gold bg-gold/5" : "border-line"
              }`}
            >
              <p className="text-sm text-ink-dim">Drag &amp; drop audio files or a whole folder here</p>
              <p className="text-xs text-ink-mute">or</p>
              <div className="flex flex-wrap justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-gold-ink transition active:scale-[0.97] hover:bg-gold-bright"
                >
                  Choose files
                </button>
                <button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  className="rounded-lg border border-teal/50 bg-teal/10 px-4 py-2 text-sm font-semibold text-teal transition active:scale-[0.97] hover:bg-teal/20"
                >
                  Choose folder
                </button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="audio/*"
              hidden
              onChange={(e) => {
                addFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              hidden
              // @ts-expect-error non-standard attributes for directory selection
              webkitdirectory=""
              directory=""
              onChange={(e) => {
                addFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />

            {rows.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-4 py-3">
                <p className="text-sm text-ink">
                  <span className="font-mono text-gold">{rows.length}</span> file{rows.length === 1 ? "" : "s"} selected
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRows([]);
                      filesRef.current.clear();
                    }}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-dim transition active:scale-[0.97] hover:bg-surface-3"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={startAnalysis}
                    className="rounded-lg bg-gold px-4 py-1.5 text-xs font-semibold text-gold-ink transition active:scale-[0.97] hover:bg-gold-bright"
                  >
                    Analyze {rows.length} file{rows.length === 1 ? "" : "s"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {(phase === "analyzing" || phase === "importing") && (
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs font-mono text-ink-mute">
              <span>
                {processed} / {activeTotal} processed
              </span>
              <span>{progressPct}%</span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-2">
              <div className="h-full bg-gold transition-all" style={{ width: `${progressPct}%` }} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {lanes.map((lane, i) => (
                <LaneCard key={i} lane={lane} />
              ))}
            </div>

            <div className="mt-4 flex gap-2.5">
              <button
                type="button"
                onClick={() => setPausedBoth(!paused)}
                className="flex-1 rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm font-medium text-ink-dim transition active:scale-[0.97] hover:bg-surface-3"
              >
                {paused ? "Resume" : "Pause"}
              </button>
              <button
                type="button"
                onClick={cancelRun}
                className="flex-1 rounded-xl border border-bad/40 bg-bad/10 px-4 py-2.5 text-sm font-medium text-bad transition active:scale-[0.97] hover:bg-bad/20"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {phase === "review" && (
          <div className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="text-ink-dim">
                <span className="text-good">{readyCount} ready</span>
                {errorCount > 0 && <span className="text-bad"> · {errorCount} failed</span>}
              </p>
              <div className="flex gap-2">
                {errorCount > 0 && (
                  <button
                    type="button"
                    onClick={retryFailed}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-dim hover:bg-surface-3"
                  >
                    Retry failed
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-dim hover:bg-surface-3"
                >
                  + Add more files
                </button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="audio/*"
              hidden
              onChange={(e) => {
                addFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />

            {rows.some((r) => r.status === "pending") && (
              <button
                type="button"
                onClick={startAnalysis}
                className="mt-2 w-full rounded-lg bg-teal/15 px-4 py-2 text-xs font-semibold text-teal hover:bg-teal/25"
              >
                Analyze {rows.filter((r) => r.status === "pending").length} newly added file(s)
              </button>
            )}

            <input
              value={reviewFilter}
              onChange={(e) => setReviewFilter(e.target.value)}
              placeholder="Filter rows…"
              className="mt-3 w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink placeholder:text-ink-mute outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
            />

            <div className="mt-3 max-h-[24rem] overflow-y-auto overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="sticky top-0 bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-mute">
                  <tr>
                    <th className="px-3 py-2 font-medium">Title</th>
                    <th className="px-3 py-2 font-medium">Artist</th>
                    <th className="w-24 px-3 py-2 font-medium">Start (s)</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="w-10 px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <ReviewTableRow key={row.clientId} row={row} onChange={updateRow} onRemove={() => removeRow(row)} />
                  ))}
                </tbody>
              </table>
              {visibleRows.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-ink-mute">No rows match this filter.</p>
              )}
            </div>

            <button
              type="button"
              onClick={startImport}
              disabled={readyCount === 0}
              className="mt-4 w-full rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-gold-ink transition active:scale-[0.98] hover:bg-gold-bright disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
            >
              Import {readyCount} song{readyCount === 1 ? "" : "s"}
            </button>
          </div>
        )}

        {phase === "done" && (
          <div className="animate-rise-in mt-5">
            <div className="animate-pop rounded-2xl border border-good/40 bg-good/10 p-5 text-center">
              <p className="font-display text-lg font-semibold text-good">Import complete</p>
              <p className="mt-2 text-sm text-ink-dim">
                <span className="font-mono text-ink">{importedCount}</span> imported
                {skippedCount > 0 && (
                  <>
                    {" · "}
                    <span className="font-mono text-ink">{skippedCount}</span> skipped (duplicates)
                  </>
                )}
                {errorCount > 0 && (
                  <>
                    {" · "}
                    <span className="font-mono text-bad">{errorCount}</span> failed
                  </>
                )}
              </p>
            </div>

            {errorCount > 0 && (
              <div className="mt-3 max-h-40 overflow-y-auto rounded-xl border border-line">
                {rows
                  .filter((r) => r.status === "error")
                  .map((r) => (
                    <div key={r.clientId} className="border-b border-line px-4 py-2 text-xs last:border-b-0">
                      <span className="font-medium text-ink">{r.fileName}</span>
                      <span className="text-ink-mute"> — {r.errorMessage}</span>
                    </div>
                  ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleClose}
              className="mt-5 w-full rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-gold-ink transition active:scale-[0.98] hover:bg-gold-bright"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function LaneCard({ lane }: { lane: LaneState }) {
  const base = "animate-rise-in rounded-lg border px-3 py-2.5 text-xs transition-colors";
  if (lane.status === "idle") {
    return <div className={`${base} border-line/60 bg-surface-2/50 text-ink-mute`}>Idle</div>;
  }
  if (lane.status === "working") {
    return (
      <div className={`${base} border-gold/30 bg-gold/5`}>
        <p className="truncate font-medium text-ink">{lane.fileName}</p>
        <p className="mt-0.5 truncate text-ink-mute">{lane.stage}</p>
      </div>
    );
  }
  if (lane.status === "error") {
    return (
      <div className={`${base} border-bad/30 bg-bad/5`}>
        <p className="truncate font-medium text-ink">{lane.fileName}</p>
        <p className="mt-0.5 truncate text-bad">{lane.message}</p>
      </div>
    );
  }
  return (
    <div className={`${base} border-good/30 bg-good/5`}>
      <p className="truncate font-medium text-ink">{lane.fileName}</p>
      <p className="mt-0.5 text-good">Done</p>
    </div>
  );
}

function ReviewTableRow({
  row,
  onChange,
  onRemove,
}: {
  row: ReviewRow;
  onChange: (clientId: string, patch: Partial<ReviewRow>) => void;
  onRemove: () => void;
}) {
  // Errored rows should stay editable — you might need to fix a title/start
  // time before retrying, not just re-run the exact same thing.
  const editable = row.status === "ready" || row.status === "error";

  return (
    <tr className="border-t border-line align-top">
      <td className="px-3 py-2">
        <input
          value={row.title}
          onChange={(e) => onChange(row.clientId, { title: e.target.value })}
          disabled={!editable}
          className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none transition focus:border-gold disabled:opacity-50"
        />
        <p className="mt-0.5 truncate text-[10px] text-ink-mute">{row.fileName}</p>
        {row.status === "error" && row.errorMessage && (
          <p className="mt-0.5 text-[10px] text-bad">{row.errorMessage}</p>
        )}
      </td>
      <td className="px-3 py-2">
        <input
          value={row.artist}
          onChange={(e) => onChange(row.clientId, { artist: e.target.value })}
          disabled={!editable}
          className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none transition focus:border-gold disabled:opacity-50"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          min={0}
          step={0.1}
          value={row.startOverride ?? ""}
          onChange={(e) => onChange(row.clientId, { startOverride: Number(e.target.value) })}
          disabled={!editable}
          className="w-20 rounded-md border border-line bg-surface px-2 py-1.5 font-mono text-sm text-ink outline-none transition focus:border-gold disabled:opacity-50"
        />
      </td>
      <td className="px-3 py-2 text-xs">
        <StatusBadge row={row} />
      </td>
      <td className="px-3 py-2">
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove row"
          className="rounded p-1 text-ink-mute hover:bg-bad/10 hover:text-bad"
        >
          <CloseIcon small />
        </button>
      </td>
    </tr>
  );
}

function StatusBadge({ row }: { row: ReviewRow }) {
  switch (row.status) {
    case "pending":
      return <span className="text-ink-mute">Queued</span>;
    case "analyzing":
      return <span className="text-teal">Analyzing…</span>;
    case "ready":
      return <span className="text-good">Ready</span>;
    case "error":
      return <span className="text-bad" title={row.errorMessage}>Error</span>;
    case "importing":
      return <span className="text-teal">Importing…</span>;
    case "imported":
      return <span className="text-good">Imported</span>;
    case "skipped":
      return <span className="text-ink-mute">Skipped (duplicate)</span>;
    default:
      return null;
  }
}

function CloseIcon({ small }: { small?: boolean }) {
  const size = small ? "h-3.5 w-3.5" : "h-5 w-5";
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={size}>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
