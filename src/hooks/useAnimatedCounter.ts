"use client";

import { useEffect, useRef, useState } from "react";

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/**
 * Smoothly interpolates a displayed number toward `target` whenever it
 * changes, rather than snapping instantly — used for the score readout.
 * Safe to re-target mid-animation (continues from wherever it currently is).
 */
export function useAnimatedCounter(target: number, durationMs = 500): number {
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    const from = displayRef.current;
    if (from === target) return;

    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      const value = Math.round(from + (target - from) * easeOutQuad(t));
      displayRef.current = value;
      setDisplay(value);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs]);

  return display;
}
