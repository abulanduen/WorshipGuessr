"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

type Props = {
  analyserRef: RefObject<AnalyserNode | null>;
  isPlaying: boolean;
  className?: string;
};

const BAR_COUNT = 28;

export function AudioVisualizer({ analyserRef, isPlaying, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, rect.width * dpr);
      canvas.height = Math.max(1, rect.height * dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const data = new Uint8Array(64);

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const analyser = analyserRef.current;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const gap = w * 0.012;
      const barWidth = (w - gap * (BAR_COUNT - 1)) / BAR_COUNT;

      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(data as Uint8Array<ArrayBuffer>);
      }

      for (let i = 0; i < BAR_COUNT; i++) {
        let value = 0;
        if (analyser && isPlaying) {
          const bin = Math.floor((i / BAR_COUNT) * (data.length * 0.6));
          value = data[bin] / 255;
        }
        const minHeight = h * 0.06;
        const barHeight = Math.max(minHeight, value * h * 0.9);
        const x = i * (barWidth + gap);
        const y = h - barHeight;
        const radius = Math.min(barWidth / 2, 6 * dpr);

        ctx.fillStyle = isPlaying
          ? `color-mix(in srgb, var(--gold) ${40 + value * 60}%, var(--teal) ${value * 20}%)`
          : "var(--surface-3)";
        drawRoundedBar(ctx, x, y, barWidth, barHeight, radius);
      }
    };

    draw();
    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [analyserRef, isPlaying]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}

function drawRoundedBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
  ctx.fill();
}
