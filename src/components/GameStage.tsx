"use client";

import { useEffect } from "react";
import type { Song } from "@/types";
import { DECK_SIZE, MIN_SONGS_TO_START } from "@/lib/constants";
import { useGame, type GuessAttempt } from "@/hooks/useGame";
import { useAudioClip } from "@/hooks/useAudioClip";
import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";
import { AudioVisualizer } from "./AudioVisualizer";
import { GuessInput } from "./GuessInput";
import { RoundSummary } from "./RoundSummary";
import { Confetti } from "./Confetti";

type Props = {
  songs: Song[];
  onScoreSaved?: () => void;
};

export function GameStage({ songs, onScoreSaved }: Props) {
  const game = useGame(songs);
  const { audioRef, analyserRef, isPlaying, play, playRemaining, stop, unlockAudio } = useAudioClip();

  const {
    phase,
    deck,
    currentIndex,
    currentSong,
    stageIndex,
    stageDuration,
    tierCount,
    guesses,
    canSkip,
    results,
    shakeToken,
    isLastSong,
    totalScore,
    startGame,
    skip,
    submitGuess,
    giveUp,
    nextSong,
    restart,
  } = game;

  useEffect(() => {
    if (!currentSong || !audioRef.current) return;
    stop();
    audioRef.current.src = currentSong.audioUrl;
    audioRef.current.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong?.id]);

  useEffect(() => {
    if (phase !== "stage" || !currentSong) return;
    const t = window.setTimeout(() => play(stageDuration), 60);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong?.id, stageIndex, phase]);

  const canStart = songs.length >= MIN_SONGS_TO_START;
  const lastResult = results[results.length - 1] ?? null;
  const animatedScore = useAnimatedCounter(totalScore);

  useEffect(() => {
    // Let a correct guess's clip keep playing past the stage cutoff, through
    // to the end of the clip, instead of cutting off right at the moment of
    // guessing.
    if (phase === "feedback" && lastResult?.correct) playRemaining();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, lastResult]);

  return (
    <section className="rounded-3xl border border-line bg-surface p-6 sm:p-9">
      {/*
        crossOrigin is required here: clips are served from Vercel Blob, a
        different origin than the app. Without it, Web Audio's
        createMediaElementSource (used for the visualizer) treats the
        element as a tainted cross-origin source and silently mutes actual
        output once routed through the audio graph — the element still
        visibly "plays" (currentTime advances, no errors), it just never
        reaches the speakers.
      */}
      <audio ref={audioRef} preload="auto" crossOrigin="anonymous" className="hidden" />

      {phase === "setup" && (
        <SetupView
          songCount={songs.length}
          canStart={canStart}
          onStart={() => {
            unlockAudio();
            startGame();
          }}
        />
      )}

      {(phase === "stage" || phase === "feedback") && currentSong && (
        <div className="animate-rise-in">
          <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.15em] text-ink-mute">
            <span>
              Song {currentIndex + 1} / {deck.length}
            </span>
            <span className="text-gold">{animatedScore} pts</span>
          </div>

          <StageTicks stageIndex={stageIndex} tierCount={tierCount} locked={phase === "feedback"} />

          <GuessHistory guesses={guesses} />

          <div className="relative mx-auto my-7 flex h-40 w-full max-w-xs items-center justify-center sm:h-48">
            <AudioVisualizer analyserRef={analyserRef} isPlaying={isPlaying} className="absolute inset-0 h-full w-full" />
            <button
              type="button"
              onClick={() => play(stageDuration)}
              aria-label={isPlaying ? "Playing" : "Play clip"}
              className={`relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-gold text-gold-ink transition active:scale-90 sm:h-24 sm:w-24 ${
                isPlaying ? "animate-pulse-ring" : ""
              }`}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
          </div>

          <div key={stageIndex} className="animate-pop text-center font-mono text-lg tracking-wide text-gold-bright">
            TIER {stageIndex + 1} <span className="text-ink-mute">/ {tierCount}</span>
          </div>

          {phase === "stage" && (
            <div className="mt-6 space-y-4">
              <GuessInput key={currentSong.id} songs={songs} shakeToken={shakeToken} onGuess={submitGuess} />

              <div className="flex flex-col gap-2.5 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    unlockAudio();
                    skip();
                  }}
                  disabled={!canSkip}
                  className="flex-1 rounded-xl border border-teal/50 bg-teal/10 px-4 py-3 text-sm font-semibold text-teal transition active:scale-[0.97] hover:bg-teal/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={giveUp}
                  className="flex-1 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm font-medium text-ink-dim transition active:scale-[0.97] hover:bg-surface-3"
                >
                  I don&apos;t know this one
                </button>
              </div>
            </div>
          )}

          {phase === "feedback" && lastResult && (
            <FeedbackPanel
              result={lastResult}
              isLastSong={isLastSong}
              onContinue={() => {
                unlockAudio();
                nextSong();
              }}
            />
          )}
        </div>
      )}

      {phase === "results" && (
        <RoundSummary results={results} totalScore={totalScore} onPlayAgain={restart} onSaved={onScoreSaved} />
      )}
    </section>
  );
}

function SetupView({
  songCount,
  canStart,
  onStart,
}: {
  songCount: number;
  canStart: boolean;
  onStart: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <h2 className="font-display text-2xl font-semibold text-ink">Ready to play?</h2>
      <p className="max-w-sm text-sm text-ink-dim">
        Each round draws {DECK_SIZE} songs at random from the setlist. Every song starts at a barely-there sliver of
        audio, growing tier by tier — a wrong guess pushes you straight to the next tier, or skip ahead yourself for
        a longer listen.
      </p>
      <p className="font-mono text-xs text-ink-mute">
        {songCount} song{songCount === 1 ? "" : "s"} in the setlist
        {!canStart && ` · need at least ${MIN_SONGS_TO_START}`}
      </p>
      <button
        type="button"
        onClick={onStart}
        disabled={!canStart}
        className="mt-2 rounded-full bg-gold px-8 py-3.5 text-sm font-semibold text-gold-ink transition active:scale-[0.97] hover:bg-gold-bright disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-mute disabled:active:scale-100"
      >
        Start round
      </button>
    </div>
  );
}

function StageTicks({ stageIndex, tierCount, locked }: { stageIndex: number; tierCount: number; locked: boolean }) {
  return (
    <div className="mt-5 flex items-end gap-1.5">
      {Array.from({ length: tierCount }, (_, i) => (
        <div key={i} className="relative flex-1">
          {i === stageIndex && (
            <div
              className={`absolute -top-2.5 left-1/2 h-0 w-0 -translate-x-1/2 border-x-4 border-t-4 border-x-transparent ${
                locked ? "border-t-teal" : "border-t-gold"
              }`}
            />
          )}
          <div
            className={`h-1.5 origin-bottom rounded-full transition-colors ${
              i <= stageIndex ? (locked ? "bg-teal" : "bg-gold") : "bg-surface-3"
            } ${i === stageIndex ? "animate-tick-fill" : ""}`}
          />
        </div>
      ))}
    </div>
  );
}

function GuessHistory({ guesses }: { guesses: (GuessAttempt | null)[] }) {
  const attempted = guesses
    .map((g, i) => ({ g, tier: i + 1 }))
    .filter((row): row is { g: GuessAttempt; tier: number } => row.g !== null);

  if (attempted.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {attempted.map(({ g, tier }) => (
        <span
          key={tier}
          className="animate-rise-in inline-flex items-center gap-1.5 rounded-full border border-bad/30 bg-bad/5 px-3 py-1 text-xs text-ink-dim"
        >
          <span className="font-mono text-ink-mute">T{tier}</span>
          <span className="max-w-[10rem] truncate">{g.text}</span>
        </span>
      ))}
    </div>
  );
}

function FeedbackPanel({
  result,
  isLastSong,
  onContinue,
}: {
  result: { song: Song; correct: boolean; gaveUp: boolean; stageIndex: number; points: number };
  isLastSong: boolean;
  onContinue: () => void;
}) {
  const good = result.correct;
  return (
    <div
      className={`animate-scale-in relative mt-6 overflow-hidden rounded-2xl border p-5 text-center ${
        good ? "border-good/40 bg-good/10" : "border-bad/40 bg-bad/10"
      }`}
    >
      {good && <Confetti />}
      <p className={`font-display text-lg font-semibold ${good ? "text-good" : "text-bad"}`}>
        {good ? "Correct!" : result.gaveUp ? "Given up" : "Not quite"}
      </p>
      <p className="mt-1 text-ink">
        <span className="font-medium">{result.song.title}</span>
        {result.song.artist && <span className="text-ink-dim"> — {result.song.artist}</span>}
      </p>
      <p className="animate-pop mt-2 font-mono text-2xl text-gold-bright">+{result.points} pts</p>
      <button
        type="button"
        onClick={onContinue}
        className="mt-5 rounded-full bg-gold px-8 py-3 text-sm font-semibold text-gold-ink transition active:scale-[0.97] hover:bg-gold-bright"
      >
        {isLastSong ? "See results" : "Next song"}
      </button>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 translate-x-0.5">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8">
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}
