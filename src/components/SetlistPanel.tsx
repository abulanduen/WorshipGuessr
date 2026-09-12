"use client";

import { useEffect, useMemo, useState } from "react";
import type { Song } from "@/types";
import { useAuth } from "@/lib/auth-context";
import { Collapsible } from "./Collapsible";
import { ConfirmDialog } from "./ConfirmDialog";
import { ManualAddForm } from "./ManualAddForm";
import { BulkImportModal } from "./BulkImportModal";

type Props = {
  songs: Song[];
  loading: boolean;
  onChanged: () => void;
};

export function SetlistPanel({ songs, loading, onChanged }: Props) {
  const { authorizedFetch, unlock } = useAuth();
  const [filter, setFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Song | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Whether the setlist itself is passcode-protected, and whether this
  // browser is currently unlocked. Starts "locked" by default so the song
  // list never flashes visible before we know — only relaxes once /api/auth
  // confirms either there's no passcode set, or this session already has it.
  const [gate, setGate] = useState<{ protectedList: boolean; unlocked: boolean }>({
    protectedList: true,
    unlocked: false,
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth")
      .then((r) => r.json())
      .then((data: { protected: boolean; authorized: boolean }) => {
        if (!cancelled) setGate({ protectedList: data.protected, unlocked: data.authorized });
      })
      .catch(() => {
        if (!cancelled) setGate({ protectedList: false, unlocked: true });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUnlock = async () => {
    const ok = await unlock();
    if (ok) setGate((g) => ({ ...g, unlocked: true }));
  };

  const locked = gate.protectedList && !gate.unlocked;

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return songs;
    return songs.filter(
      (s) => s.title.toLowerCase().includes(q) || (s.artist ?? "").toLowerCase().includes(q)
    );
  }, [songs, filter]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const res = await authorizedFetch(`/api/songs/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete song");
      setDeleteTarget(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete song");
    } finally {
      setBusy(false);
    }
  };

  const handleClear = async () => {
    setBusy(true);
    try {
      const res = await authorizedFetch("/api/songs", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clear setlist");
      setClearOpen(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear setlist");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Collapsible
      title="Setlist"
      subtitle={loading ? "Loading…" : `${songs.length} song${songs.length === 1 ? "" : "s"}`}
      defaultOpen={songs.length === 0}
    >
      {locked ? (
        <div className="animate-rise-in flex flex-col items-center gap-3 rounded-xl border border-dashed border-line px-4 py-10 text-center">
          <LockIcon />
          <p className="text-sm text-ink-dim">
            The song list is hidden so players can&apos;t browse the answers. Enter the passcode to view and edit it.
          </p>
          <button
            type="button"
            onClick={handleUnlock}
            className="rounded-full bg-gold px-6 py-2.5 text-sm font-semibold text-gold-ink transition active:scale-[0.97] hover:bg-gold-bright"
          >
            Unlock setlist
          </button>
        </div>
      ) : (
        <div className="animate-rise-in flex flex-col gap-3">
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={() => setShowBulk(true)}
              className="flex-1 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-gold-ink transition active:scale-[0.97] hover:bg-gold-bright"
            >
              Bulk import
            </button>
            <button
              type="button"
              onClick={() => setShowAdd((s) => !s)}
              className="flex-1 rounded-xl border border-teal/50 bg-teal/10 px-4 py-2.5 text-sm font-semibold text-teal transition active:scale-[0.97] hover:bg-teal/20"
            >
              {showAdd ? "Cancel" : "Add one song"}
            </button>
          </div>

          {showAdd && (
            <ManualAddForm
              onAdded={() => {
                setShowAdd(false);
                onChanged();
              }}
            />
          )}

          {error && <p className="text-sm text-bad">{error}</p>}

          {songs.length > 0 && (
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter songs…"
              className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink placeholder:text-ink-mute outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
          )}

          {songs.length === 0 && !loading && (
            <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-mute">
              No songs yet. Bulk-import a folder of audio files, or add one manually to get started.
            </p>
          )}

          {filtered.length > 0 && (
            <ul className="max-h-[26rem] space-y-1.5 overflow-y-auto pr-1">
              {filtered.map((song, i) => (
                <SongRow
                  key={song.id}
                  song={song}
                  index={i}
                  editing={editingId === song.id}
                  onEdit={() => setEditingId(song.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onSaved={() => {
                    setEditingId(null);
                    onChanged();
                  }}
                  onDeleteRequest={() => setDeleteTarget(song)}
                />
              ))}
            </ul>
          )}

          {songs.length > 0 && (
            <button
              type="button"
              onClick={() => setClearOpen(true)}
              className="self-start text-xs font-medium text-bad/80 transition hover:text-bad hover:underline"
            >
              Clear entire setlist
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove this song?"
        message={`"${deleteTarget?.title}" will be removed from the setlist and its clip deleted.`}
        confirmLabel="Remove"
        danger
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmDialog
        open={clearOpen}
        title="Clear the entire setlist?"
        message={`This permanently deletes all ${songs.length} songs and their audio clips. This can't be undone.`}
        confirmLabel="Clear everything"
        danger
        busy={busy}
        onConfirm={handleClear}
        onCancel={() => setClearOpen(false)}
      />

      {showBulk && (
        <BulkImportModal
          onClose={() => setShowBulk(false)}
          onImported={() => {
            onChanged();
          }}
        />
      )}
    </Collapsible>
  );
}

function SongRow({
  song,
  index,
  editing,
  onEdit,
  onCancelEdit,
  onSaved,
  onDeleteRequest,
}: {
  song: Song;
  index: number;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaved: () => void;
  onDeleteRequest: () => void;
}) {
  const { authorizedFetch } = useAuth();
  const [title, setTitle] = useState(song.title);
  const [artist, setArtist] = useState(song.artist ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await authorizedFetch(`/api/songs/${song.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), artist: artist.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to save changes");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <li className="animate-scale-in rounded-xl border border-gold/40 bg-surface-2 p-3">
        <div className="flex flex-col gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-gold"
          />
          <input
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="Artist"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-gold"
          />
          {error && <p className="animate-rise-in text-xs text-bad">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-gold-ink transition active:scale-[0.96] disabled:opacity-50 disabled:active:scale-100"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-dim transition active:scale-[0.96] hover:bg-surface-3"
            >
              Cancel
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li
      className="animate-rise-in flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-4 py-2.5"
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
    >
      <div className="min-w-0">
        <p className="truncate font-medium text-ink">{song.title}</p>
        {song.artist && <p className="truncate text-xs text-ink-mute">{song.artist}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit song"
          className="rounded-lg p-2 text-ink-mute transition active:scale-90 hover:bg-surface-3 hover:text-ink"
        >
          <EditIcon />
        </button>
        <button
          type="button"
          onClick={onDeleteRequest}
          aria-label="Delete song"
          className="rounded-lg p-2 text-ink-mute transition active:scale-90 hover:bg-bad/10 hover:text-bad"
        >
          <TrashIcon />
        </button>
      </div>
    </li>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6 text-ink-mute">
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 018 0v3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path
        d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path
        d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
