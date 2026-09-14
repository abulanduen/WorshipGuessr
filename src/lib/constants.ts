// Clip tier lengths (seconds) and points awarded for guessing correctly at
// that tier. Tiers are shown to players as "Tier N", not literal times —
// that also gives us room to keep the shortest tier long enough to
// reliably produce audible sound on mobile (short devices/browsers have a
// real startup delay before audio output begins; anything much under 0.5s
// risked being silent even with playback padding).
export const STAGE_DURATIONS = [0.5, 1, 2, 3, 5, 7, 10, 15] as const;
export const STAGE_POINTS = [500, 350, 250, 175, 125, 90, 60, 30] as const;

export const DECK_SIZE = 8;
export const MIN_SONGS_TO_START = 4;

// Target length of a trimmed/encoded clip stored on disk.
export const CLIP_TARGET_SECONDS = 18;
export const CLIP_LEAD_IN_SECONDS = 1.5;
export const CLIP_PROBE_WINDOW_SECONDS = 9;
export const CLIP_SKIP_START_FRACTION = 0.06;
export const CLIP_SKIP_END_FRACTION = 0.04;

export const LEADERBOARD_SIZE = 10;
export const BULK_IMPORT_CONCURRENCY = 6;

export const SUPPORTED_AUDIO_EXTENSIONS = [
  ".mp3",
  ".m4a",
  ".aac",
  ".wav",
  ".flac",
  ".ogg",
  ".oga",
  ".opus",
  ".wma",
  ".aiff",
  ".aif",
];
