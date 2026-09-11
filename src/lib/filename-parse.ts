const LEADING_TRACK_NUMBER = /^\s*\d{1,3}\s*[.)\-]?\s+/;
const SEPARATORS = /\s[-–—]\s/;

const SMALL_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "in",
  "nor",
  "of",
  "on",
  "or",
  "so",
  "the",
  "to",
  "up",
  "yet",
]);

function hasExistingCasingSignal(s: string): boolean {
  const hasLower = /[a-z]/.test(s);
  const hasUpper = /[A-Z]/.test(s);
  // Mixed upper+lower is a deliberate casing signal (e.g. "Way Maker", "iAmSov").
  // ALL CAPS, all-lowercase, or no letters at all have no signal worth preserving.
  return hasLower && hasUpper;
}

export function titleCase(s: string): string {
  const words = s.split(/(\s+)/); // keep whitespace tokens for reassembly
  let wordIndex = 0;
  const total = words.filter((w) => !/^\s+$/.test(w)).length;
  return words
    .map((w) => {
      if (/^\s+$/.test(w) || w.length === 0) return w;
      const isFirst = wordIndex === 0;
      const isLast = wordIndex === total - 1;
      wordIndex++;
      const lower = w.toLowerCase();
      if (!isFirst && !isLast && SMALL_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

export type ParsedFilename = {
  title: string;
  artist: string | null;
};

/**
 * Fallback metadata extraction from a bare filename (no extension), used when
 * ID3/embedded tags are missing. Handles "Artist - Title", a leading track
 * number, and falls back to the whole cleaned name as the title.
 */
export function parseFilename(rawName: string): ParsedFilename {
  let name = rawName.replace(LEADING_TRACK_NUMBER, "").trim();
  name = name.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();

  const parts = name.split(SEPARATORS);

  let title: string;
  let artist: string | null;

  if (parts.length >= 2) {
    artist = parts[0].trim();
    title = parts.slice(1).join(" - ").trim();
  } else {
    title = name;
    artist = null;
  }

  if (title && !hasExistingCasingSignal(title)) title = titleCase(title);
  if (artist && !hasExistingCasingSignal(artist)) artist = titleCase(artist);

  return { title: title || rawName, artist: artist || null };
}

export function stripExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  if (idx <= 0) return fileName;
  return fileName.slice(0, idx);
}

export function normalizeKey(title: string, artist: string | null | undefined): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  return `${norm(title)}::${norm(artist ?? "")}`;
}
