"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type AudioContextCtor = typeof AudioContext;

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
      if (audioCtxRef.current?.state === "suspended") audioCtxRef.current.resume().catch(() => {});

      audio.currentTime = 0;
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));

      stopTimerRef.current = window.setTimeout(() => {
        audio.pause();
        setIsPlaying(false);
      }, Math.max(50, durationSeconds * 1000));
    },
    [clearStopTimer, ensureGraph]
  );

  const stop = useCallback(() => {
    clearStopTimer();
    audioRef.current?.pause();
    setIsPlaying(false);
  }, [clearStopTimer]);

  useEffect(() => {
    return () => {
      clearStopTimer();
      audioCtxRef.current?.close().catch(() => {});
    };
  }, [clearStopTimer]);

  return { audioRef, analyserRef, isPlaying, play, stop };
}
