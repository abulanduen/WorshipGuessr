"use client";

import { useState } from "react";
import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  headerRight?: ReactNode;
  children: ReactNode;
};

export function Collapsible({ title, subtitle, defaultOpen = false, headerRight, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-3xl border border-line bg-surface shadow-md shadow-black/15 transition-shadow">
      <div className="flex items-center gap-3 px-5 py-4 sm:px-7">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex flex-1 items-center gap-3 text-left"
        >
          <ChevronIcon open={open} />
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
            {subtitle && <p className="text-xs text-ink-mute">{subtitle}</p>}
          </div>
        </button>
        {headerRight}
      </div>
      <div className={`collapsible-rows ${open ? "is-open" : ""}`}>
        <div>
          <div className="border-t border-line px-5 py-5 sm:px-7">{children}</div>
        </div>
      </div>
    </section>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={`h-4 w-4 shrink-0 text-ink-mute transition-transform duration-300 ${open ? "rotate-90" : ""}`}
    >
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
