"use client";

import { DECK_SIZE, STAGE_POINTS } from "@/lib/constants";
import { ModalPanel } from "./ModalPanel";

export function HowToPlayModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalPanel title="How to play" onClose={onClose}>
      <div className="flex flex-col gap-3 text-sm text-ink-dim">
        <p>
          Each round draws {DECK_SIZE} songs at random from the setlist. Every song starts at a barely-there sliver
          of audio, growing tier by tier.
        </p>
        <p>
          Every guess — right or wrong — uses up the current tier. Guess wrong and you&apos;re pushed straight to the
          next, longer tier. Skip ahead yourself if you&apos;d rather listen longer before guessing.
        </p>
        <p>The earlier you name it, the more it&apos;s worth:</p>
        <ul className="grid grid-cols-4 gap-1.5 font-mono text-xs">
          {STAGE_POINTS.map((points, i) => (
            <li key={i} className="rounded-lg bg-surface-2 px-2 py-1.5 text-center">
              <span className="block text-ink-mute">T{i + 1}</span>
              <span className="text-gold">{points}</span>
            </li>
          ))}
        </ul>
      </div>
    </ModalPanel>
  );
}
