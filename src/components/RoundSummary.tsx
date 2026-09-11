"use client";

import { useState } from "react";
import type { RoundResult } from "@/types";

type Props = {
  results: RoundResult[];
  totalScore: number;
  onPlayAgain: () => void;
  onSaved?: () => void;
};

export function RoundSummary({ results, totalScore, onPlayAgain, onSaved }: Props) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), score: totalScore, roundsPlayed: results.length }),
      });
      if (!res.ok) throw new Error("Failed to save score");
      setSaved(true);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-rise-in">
      <h2 className="text-center font-display text-2xl font-semibold text-ink">Round complete</h2>
      <p className="mt-2 text-center font-mono text-4xl text-gold-bright">{totalScore} pts</p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-mute">
              <th className="px-3 py-2 font-medium">Song</th>
              <th className="px-3 py-2 font-medium">Stage</th>
              <th className="px-3 py-2 text-right font-medium">Points</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={`${r.song.id}-${i}`} className="border-t border-line">
                <td className="max-w-[12rem] px-3 py-2 align-top">
                  <div className="truncate font-medium text-ink">{r.song.title}</div>
                  {r.song.artist && <div className="truncate text-xs text-ink-mute">{r.song.artist}</div>}
                </td>
                <td className="whitespace-nowrap px-3 py-2 align-top font-mono text-ink-dim">
                  {r.gaveUp ? "—" : `#${r.stageIndex + 1}`}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right align-top font-mono text-gold">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!saved ? (
        <form onSubmit={handleSave} className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={40}
            className="flex-1 rounded-xl border border-line bg-surface-2 px-4 py-3 text-ink placeholder:text-ink-mute outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
          />
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="rounded-xl bg-gold px-6 py-3 text-sm font-semibold text-gold-ink transition hover:bg-gold-bright disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save score"}
          </button>
        </form>
      ) : (
        <p className="mt-6 text-center text-sm font-medium text-good">Saved to the leaderboard!</p>
      )}
      {error && <p className="mt-2 text-center text-sm text-bad">{error}</p>}

      <button
        type="button"
        onClick={onPlayAgain}
        className="mt-6 w-full rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm font-medium text-ink-dim transition hover:bg-surface-3"
      >
        Play again
      </button>
    </div>
  );
}
