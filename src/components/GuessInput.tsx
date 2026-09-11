"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Song } from "@/types";
import { exactTitleMatch, rankSongMatches } from "@/lib/song-search";

type Props = {
  songs: Song[];
  disabled?: boolean;
  shakeToken: number;
  onGuess: (songId: string | null) => void;
};

type Rect = { top: number; left: number; width: number };

export function GuessInput({ songs, disabled, shakeToken, onGuess }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const [shaking, setShaking] = useState(false);
  const [lastShakeToken, setLastShakeToken] = useState(shakeToken);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Derived-state-from-props pattern (React docs "Adjusting state when a
  // prop changes"): flips shaking on during render instead of in an effect;
  // only the auto-reset timer below needs an effect.
  if (shakeToken !== lastShakeToken) {
    setLastShakeToken(shakeToken);
    if (shakeToken !== 0) setShaking(true);
  }

  useEffect(() => {
    if (!shaking) return;
    const t = setTimeout(() => setShaking(false), 500);
    return () => clearTimeout(t);
  }, [shaking]);

  const matches = useMemo(() => rankSongMatches(query, songs), [query, songs]);

  const updateRect = () => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.bottom + 6, left: r.left, width: r.width });
  };

  useEffect(() => {
    if (!open) return;
    updateRect();
    const handler = () => updateRect();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [open]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const commit = (songId: string | null) => {
    onGuess(songId);
    setQuery("");
    setOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    const exact = exactTitleMatch(query, songs);
    commit(exact ? exact.id : null);
  };

  const handlePick = (song: Song) => commit(song.id);

  return (
    <div ref={wrapperRef} className="relative">
      <form onSubmit={handleSubmit} className={shaking ? "animate-shake" : ""}>
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={disabled}
          value={query}
          placeholder="Type the song title…"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            requestAnimationFrame(updateRect);
          }}
          onFocus={() => {
            setOpen(true);
            updateRect();
          }}
          className="w-full rounded-xl border border-line bg-surface-2 px-4 py-3.5 text-base text-ink placeholder:text-ink-mute outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </form>

      {open &&
        matches.length > 0 &&
        rect &&
        typeof document !== "undefined" &&
        createPortal(
          <ul
            role="listbox"
            style={{
              position: "fixed",
              top: rect.top,
              left: rect.left,
              width: rect.width,
              zIndex: 9999,
            }}
            className="max-h-72 overflow-y-auto rounded-xl border border-line bg-surface-2 shadow-2xl shadow-black/50"
          >
            {matches.map((song) => (
              <li key={song.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handlePick(song)}
                  className="flex w-full flex-col items-start gap-0.5 border-b border-line/60 px-4 py-2.5 text-left last:border-b-0 hover:bg-surface-3"
                >
                  <span className="text-sm font-medium text-ink">{song.title}</span>
                  {song.artist && <span className="text-xs text-ink-mute">{song.artist}</span>}
                </button>
              </li>
            ))}
          </ul>,
          document.body
        )}
    </div>
  );
}
