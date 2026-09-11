"use client";

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  danger,
  busy,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div className="animate-backdrop-in fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4">
      <div className="animate-scale-in w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-2xl">
        <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
        <p className="mt-2 text-sm text-ink-dim">{message}</p>
        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm font-medium text-ink-dim transition active:scale-[0.97] hover:bg-surface-3"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100 ${
              danger ? "bg-bad text-gold-ink hover:brightness-110" : "bg-gold text-gold-ink hover:bg-gold-bright"
            }`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
