"use client";

import { useState } from "react";

const COLORS = ["var(--gold)", "var(--gold-bright)", "var(--teal)", "var(--good)"];
const PIECE_COUNT = 18;

type Piece = {
  left: number;
  delay: number;
  duration: number;
  drift: number;
  spin: number;
  color: string;
  size: number;
};

function generatePieces(): Piece[] {
  return Array.from({ length: PIECE_COUNT }, () => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.15,
    duration: 0.7 + Math.random() * 0.5,
    drift: (Math.random() - 0.5) * 120,
    spin: (Math.random() - 0.5) * 480,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 5 + Math.random() * 4,
  }));
}

/**
 * A one-shot confetti burst, absolutely positioned to fill its parent
 * (which should be `position: relative`). Purely decorative — remounting
 * with a fresh `key` on the parent replays it. Piece layout is randomized
 * in an effect (not during render) since Math.random isn't a pure render call.
 */
export function Confetti() {
  // Lazy initializer: runs exactly once on mount, which is the sanctioned
  // way to seed state from an impure source (Math.random) without React
  // treating it as an impure render or an effect-triggered re-render.
  const [pieces] = useState<Piece[]>(() => generatePieces());

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="animate-confetti absolute top-0 rounded-[2px]"
          style={
            {
              left: `${p.left}%`,
              width: p.size,
              height: p.size * 0.4,
              backgroundColor: p.color,
              animationDelay: `${p.delay}s`,
              "--fall-duration": `${p.duration}s`,
              "--drift": `${p.drift}px`,
              "--spin": `${p.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
