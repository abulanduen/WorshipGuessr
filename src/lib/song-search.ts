import type { Song } from "@/types";

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

const MAX_RESULTS = 25;

/**
 * Ranks songs for the guess autocomplete: title starts-with, then artist
 * starts-with, then title contains, then artist contains; alphabetical
 * within each tier.
 */
export function rankSongMatches(query: string, songs: Song[]): Song[] {
  const q = normalizeText(query);
  if (!q) return [];

  const titleStarts: Song[] = [];
  const artistStarts: Song[] = [];
  const titleContains: Song[] = [];
  const artistContains: Song[] = [];

  for (const s of songs) {
    const title = normalizeText(s.title);
    const artist = normalizeText(s.artist ?? "");
    if (title.startsWith(q)) titleStarts.push(s);
    else if (artist && artist.startsWith(q)) artistStarts.push(s);
    else if (title.includes(q)) titleContains.push(s);
    else if (artist && artist.includes(q)) artistContains.push(s);
  }

  const byTitle = (a: Song, b: Song) => a.title.localeCompare(b.title);
  titleStarts.sort(byTitle);
  artistStarts.sort(byTitle);
  titleContains.sort(byTitle);
  artistContains.sort(byTitle);

  return [...titleStarts, ...artistStarts, ...titleContains, ...artistContains].slice(0, MAX_RESULTS);
}

export function exactTitleMatch(query: string, songs: Song[]): Song | null {
  const q = normalizeText(query);
  if (!q) return null;
  return songs.find((s) => normalizeText(s.title) === q) ?? null;
}
