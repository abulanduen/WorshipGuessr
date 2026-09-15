# WorshipGuessr

Guess the worship song from a growing audio clip — a Next.js rebuild of the "guess the song" party game, built for a worship team's own setlist.

Data is shared, not local: the setlist, leaderboard, and audio clips all live in the cloud (Postgres + Cloudflare R2), so everyone playing the deployed site sees the same setlist, regardless of who uploaded it.

## Getting started

1. Copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL` — a Postgres connection string (Vercel Postgres/Prisma Postgres, Neon, Supabase, or any Postgres instance work).
   - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` — a [Cloudflare R2](https://developers.cloudflare.com/r2/) bucket with public access enabled. Audio clips are stored here, not on local disk — there's no local-storage fallback, so this is required even for local dev. R2 has no egress/bandwidth fees, unlike most object storage.
2. Install and run:

```bash
npm install
npx prisma migrate deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Nothing is written to local disk except transient scratch files during audio processing (in your OS temp folder) — those are cleaned up automatically after each request.

## Getting your setlist in

Open the **Setlist** panel and click **Bulk import** to drop in a folder of audio files (or drag-and-drop one straight onto the dialog). Each file is:

1. Read for ID3/embedded tags (title/artist), falling back to parsing the filename (`Artist - Title`, a leading track number, etc.) if there are no tags.
2. Scanned with a loudness heuristic to guess where a chorus-like, sustained loud stretch starts — a stand-in for real chorus detection, not the real thing. Nudge the "start (s)" field in the review table if it picks a bad spot.
3. Left in an editable review table — nothing is written to the setlist until you click **Import**.

Under the hood, each file goes: original upload → analyzed and pushed to R2 as a "staging" file → (once you click Import) downloaded back, trimmed/encoded with ffmpeg, and the final short clip is pushed to R2 as the permanent one. The staging copy is deleted as soon as a row is imported, skipped as a duplicate, or removed from the review table.

Files process in parallel (6 at a time by default) with pause/cancel/retry-failed controls. Duplicate title+artist combinations are skipped automatically and reported in the summary.

For one-off fixes, use **Add one song** instead.

## Optional: protecting the setlist

By default anyone with the URL can edit the setlist. If you want a lightweight speed-bump against accidental edits (not real security — the passcode travels in plaintext and there's no rate limiting), set a passcode in `.env`:

```
SETLIST_PASSCODE="something-your-team-knows"
```

Restart the dev server after changing it. With a passcode set, adding/editing/deleting songs, bulk import, and clearing the setlist will prompt for it once and remember it in a cookie for 30 days. Leave it blank (the default) to disable the prompt entirely. Playing the game and saving scores are never gated.

## Deploying on Vercel

1. Import the repo into a new Vercel project.
2. In the project's **Storage** tab, create a Postgres database and connect it to the project.
3. In [Cloudflare's dashboard](https://dash.cloudflare.com/), create an R2 bucket, enable public access on it (r2.dev subdomain or a custom domain), and create an API token scoped to that bucket.
4. In **Settings → Environment Variables**, make sure there's a variable literally named `DATABASE_URL` pointing at your Postgres connection string (Vercel sometimes names it with a prefix like `postgres_DATABASE_URL` when connected through an integration — if so, add a plain `DATABASE_URL` entry with the same value, since Prisma is configured to read that exact name), and add `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, and `R2_PUBLIC_URL`.
5. Redeploy. On first deploy, run `npx prisma migrate deploy` against the production `DATABASE_URL` (locally, with your `.env` pointed at production, or via a Vercel deploy hook) to create the schema.

Audio processing (ffmpeg trim/encode) runs in a serverless function with `maxDuration` raised to 60s on the relevant routes — long files or a slow connection could still hit that ceiling; if bulk imports start failing on very long tracks, that's the first thing to look at.

## Stack

- Next.js (App Router) + TypeScript, Tailwind CSS v4
- Prisma + Postgres for the setlist and leaderboard
- Cloudflare R2 for audio storage — trimmed clips and in-progress bulk-import staging files
- `music-metadata` for ID3 tag reading, `ffmpeg-static`/`fluent-ffmpeg` for trimming and encoding clips to AAC/MP4 — no system ffmpeg install required, a binary is bundled via npm

## Production build

```bash
npm run build
npm start
```
