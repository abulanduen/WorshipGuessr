"use client";

import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
};

export function ModalPanel({ title, subtitle, onClose, children }: Props) {
  return (
    <div
      className="animate-backdrop-in fixed inset-0 z-[9997] flex items-start justify-center overflow-y-auto bg-black/75 p-3 py-8 sm:p-6"
      onClick={onClose}
    >
      <div
        className="animate-scale-in w-full max-w-lg rounded-3xl border border-line bg-surface p-5 sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
            {subtitle && <p className="mt-1 text-xs text-ink-mute">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1.5 text-ink-mute hover:bg-surface-3 hover:text-ink"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
