# WorshipGuessr

Guess the worship song from a growing audio clip — a Next.js rebuild of the "guess the song" party game, built for a worship team's own setlist.

## Getting started

```bash
npm install
npx prisma migrate deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The first run creates a local SQLite database at `prisma/dev.db` (already migrated by the command above) and two folders the app writes to:

- `public/uploads/` — the short, trimmed audio clips the app serves to players.
- `.data/staging/` — full-length originals temporarily held between "analyze" and "import" during bulk import. These are cleaned up automatically as rows are imported, skipped, or removed, and are **not** web-accessible (kept outside `public/`).

Neither folder is committed to git; both are created automatically the first time they're needed.

## Getting your setlist in

Open the **Setlist** panel and click **Bulk import** to drop in a folder of audio files (or drag-and-drop one straight onto the dialog). Each file is:

1. Read for ID3/embedded tags (title/artist), falling back to parsing the filename (`Artist - Title`, a leading track number, etc.) if there are no tags.
2. Scanned with a loudness heuristic to guess where a chorus-like, sustained loud stretch starts — a stand-in for real chorus detection, not the real thing. Nudge the "start (s)" field in the review table if it picks a bad spot.
3. Left in an editable review table — nothing is written to the setlist until you click **Import**.

Files process in parallel (6 at a time by default) with pause/cancel/retry-failed controls. Duplicate title+artist combinations are skipped automatically and reported in the summary.

For one-off fixes, use **Add one song** instead.

## Optional: protecting the setlist

By default anyone with the URL can edit the setlist. If you want a lightweight speed-bump against accidental edits (not real security — the passcode travels in plaintext and there's no rate limiting), set a passcode in `.env`:

```
SETLIST_PASSCODE="something-your-team-knows"
```

Restart the dev server after changing it. With a passcode set, adding/editing/deleting songs, bulk import, and clearing the setlist will prompt for it once and remember it in a cookie for 30 days. Leave it blank (the default) to disable the prompt entirely. Playing the game and saving scores are never gated.

## Stack

- Next.js (App Router) + TypeScript, Tailwind CSS v4
- Prisma + SQLite for local dev — swap the `prisma/schema.prisma` datasource provider (and `DATABASE_URL`) to point at Postgres for a shared/deployed setup; the schema itself doesn't need to change
- `music-metadata` for ID3 tag reading, `ffmpeg-static`/`fluent-ffmpeg` for trimming and encoding clips to AAC/MP4 — no system ffmpeg install required, a binary is bundled via npm

## Production build

```bash
npm run build
npm start
```
