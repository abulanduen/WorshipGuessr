"use client";

import { useEffect, useState } from "react";
import type { ScoreEntry } from "@/types";
import { ModalPanel } from "./ModalPanel";

export function LeaderboardPanel({ refreshKey, onClose }: { refreshKey: number; onClose: () => void }) {
  const [scores, setScores] = useState<ScoreEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/scores")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setScores(data);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load leaderboard");
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <ModalPanel title="Leaderboard" subtitle="Top 10 scores" onClose={onClose}>
      {error && <p className="text-sm text-bad">{error}</p>}
      {!error && scores === null && (
        <ol className="space-y-1.5">
          {[0, 1, 2].map((i) => (
            <li key={i} className="animate-shimmer h-11 rounded-xl" style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </ol>
      )}
      {!error && scores?.length === 0 && (
        <p className="animate-rise-in text-sm text-ink-mute">No scores yet — be the first to play!</p>
      )}
      {!error && scores && scores.length > 0 && (
        <ol className="space-y-1.5">
          {scores.map((s, i) => (
            <li
              key={s.id}
              className="animate-rise-in flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-4 py-2.5 transition-transform"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-5 shrink-0 font-mono text-sm text-ink-mute">{i + 1}</span>
                <span className="truncate font-medium text-ink">{s.name}</span>
              </div>
              <div className="flex shrink-0 items-center gap-3 font-mono text-sm">
                <span className="hidden text-ink-mute sm:inline">{s.roundsPlayed} songs</span>
                <span className="text-gold">{s.score}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </ModalPanel>
  );
}
