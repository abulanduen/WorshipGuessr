"use client";

import { useCallback, useEffect, useState } from "react";
import type { Song } from "@/types";
import { AuthProvider } from "@/lib/auth-context";
import { GameStage } from "./GameStage";
import { SetlistPanel } from "./SetlistPanel";
import { LeaderboardPanel } from "./LeaderboardPanel";

export function HomeClient() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaderboardKey, setLeaderboardKey] = useState(0);

  const refetchSongs = useCallback(async () => {
    try {
      const res = await fetch("/api/songs");
      if (!res.ok) return;
      const data: Song[] = await res.json();
      setSongs(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetchSongs();
  }, [refetchSongs]);

  return (
    <AuthProvider>
      <div className="mx-auto flex min-h-screen w-full max-w-[640px] flex-col gap-7 px-4 py-10 sm:px-6 sm:py-14">
        <header className="animate-rise-in text-center">
          <h1 className="font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Worship<span className="text-gold">Guessr</span>
          </h1>
          <p className="mt-2 text-sm text-ink-dim">Name the song before the clip gives it away.</p>
        </header>

        <GameStage songs={songs} onScoreSaved={() => setLeaderboardKey((k) => k + 1)} />

        <SetlistPanel songs={songs} loading={loading} onChanged={refetchSongs} />

        <LeaderboardPanel refreshKey={leaderboardKey} />

        <footer className="pb-4 pt-2 text-center text-[11px] text-ink-mute">
          Built for the worship team · clips are short, low-fi snippets for practice guessing only.
        </footer>
      </div>
    </AuthProvider>
  );
}
