"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type AudioContextCtor = typeof AudioContext;

// Real devices (mobile Safari especially) have a startup delay between
// calling play() and audio actually reaching the speakers. For very short
// clips (the 0.1s/0.2s opening stages), that delay alone can eat the whole
// window and produce no audible sound at all. Padding the actual stop time
// slightly gives playback enough runway to become audible without
// meaningfully changing the experience for longer stages.
const PLAYBACK_STARTUP_PAD_MS = 120;

/**
 * Owns a single <audio> element plus a lazily-created Web Audio analyser
 * graph (for the cosmetic visualizer). The AnalyserNode is exposed via a ref
 * so a canvas-driving component can poll it every animation frame without
 * forcing re-renders here. Degrades silently if the Web Audio API is
 * unavailable — playback still works, the visualizer just stays empty.
 */
export function useAudioClip() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const ensureGraph = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || analyserRef.current) return analyserRef.current;
    try {
      const Ctx: AudioContextCtor | undefined =
        window.AudioContext || (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
      if (!Ctx) return null;
      const ctx = new Ctx();
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
    } catch {
      return null;
    }
    return analyserRef.current;
  }, []);

  const clearStopTimer = useCallback(() => {
    if (stopTimerRef.current !== null) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  }, []);

  const play = useCallback(
    (durationSeconds: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      clearStopTimer();
      ensureGraph();

      const startPlayback = () => {
        audio.currentTime = 0;
        audio
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));

        stopTimerRef.current = window.setTimeout(() => {
          audio.pause();
          setIsPlaying(false);
        }, durationSeconds * 1000 + PLAYBACK_STARTUP_PAD_MS);
      };

      // Once createMediaElementSource() is in play, actual audio output is
      // routed through the Web Audio graph — starting playback (and its
      // auto-stop timer, which matters most for very short first-stage
      // clips) before a suspended context has actually resumed can produce
      // a clip that visibly "plays" but is never audible.
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state === "suspended") {
        ctx.resume().then(startPlayback).catch(startPlayback);
      } else {
        startPlayback();
      }
    },
    [clearStopTimer, ensureGraph]
  );

  const stop = useCallback(() => {
    clearStopTimer();
    audioRef.current?.pause();
    setIsPlaying(false);
  }, [clearStopTimer]);

  /**
   * Continues playback from wherever it currently is (or resumes it, if the
   * stage's auto-stop already paused it) through to the natural end of the
   * clip, instead of cutting off at the guessed stage's duration — used to
   * let the rest of the clip play out after a correct guess.
   */
  const playRemaining = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    clearStopTimer();
    ensureGraph();

    const resumePlayback = () => {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    };

    const ctx = audioCtxRef.current;
    if (ctx && ctx.state === "suspended") {
      ctx.resume().then(resumePlayback).catch(resumePlayback);
    } else {
      resumePlayback();
    }
  }, [clearStopTimer, ensureGraph]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => setIsPlaying(false);
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, []);

  useEffect(() => {
    return () => {
      clearStopTimer();
      audioCtxRef.current?.close().catch(() => {});
    };
  }, [clearStopTimer]);

  return { audioRef, analyserRef, isPlaying, play, playRemaining, stop };
}
