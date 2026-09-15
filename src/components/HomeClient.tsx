"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Song } from "@/types";
import { AuthProvider } from "@/lib/auth-context";
import { GameStage } from "./GameStage";
import { SetlistPanel } from "./SetlistPanel";
import { LeaderboardPanel } from "./LeaderboardPanel";
import { HowToPlayModal } from "./HowToPlayModal";

export function HomeClient() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaderboardKey, setLeaderboardKey] = useState(0);

  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showSetlist, setShowSetlist] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // First-time setup: nudge straight to the setlist instead of leaving
  // visitors staring at a "0 songs" state with no obvious next step. Only
  // auto-opens once, on the initial load — a deliberate "Clear setlist"
  // later shouldn't reopen it on top of whatever the user's already doing.
  const hasAutoOpenedSetlist = useRef(false);

  const refetchSongs = useCallback(async () => {
    try {
      const res = await fetch("/api/songs");
      if (!res.ok) return;
      const data: Song[] = await res.json();
      setSongs(data);
      if (!hasAutoOpenedSetlist.current && data.length === 0) {
        hasAutoOpenedSetlist.current = true;
        setShowSetlist(true);
      }
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
        <header className="animate-rise-in flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowHowToPlay(true)}
            aria-label="How to play"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line text-ink-dim transition active:scale-90 hover:bg-surface-2 hover:text-ink"
          >
            <MenuIcon />
          </button>

          <h1 className="truncate px-1 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            Worship<span className="text-gold">Guessr</span>
          </h1>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSetlist(true)}
              aria-label="Setlist"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink-dim transition active:scale-90 hover:bg-surface-2 hover:text-ink"
            >
              <ListIcon />
            </button>
            <button
              type="button"
              onClick={() => setShowLeaderboard(true)}
              aria-label="Leaderboard"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink-dim transition active:scale-90 hover:bg-surface-2 hover:text-ink"
            >
              <TrophyIcon />
            </button>
          </div>
        </header>

        <GameStage songs={songs} onScoreSaved={() => setLeaderboardKey((k) => k + 1)} />

        {showHowToPlay && <HowToPlayModal onClose={() => setShowHowToPlay(false)} />}

        {showSetlist && (
          <SetlistPanel songs={songs} loading={loading} onChanged={refetchSongs} onClose={() => setShowSetlist(false)} />
        )}

        {showLeaderboard && (
          <LeaderboardPanel refreshKey={leaderboardKey} onClose={() => setShowLeaderboard(false)} />
        )}

        <footer className="pb-4 pt-2 text-center text-[11px] text-ink-mute">
          Built for the worship team · clips are short, low-fi snippets for practice guessing only.
        </footer>
      </div>
    </AuthProvider>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 21h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 21" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 21" />
      <path d="M18 3H6v7a6 6 0 0 0 12 0V3Z" />
    </svg>
  );
}
