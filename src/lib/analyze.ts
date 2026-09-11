import { parseFile } from "music-metadata";
import { decodeToPcm, probeDuration } from "./ffmpeg";
import { findChorusStart } from "./chorus-finder";
import { parseFilename, stripExtension } from "./filename-parse";
import { CLIP_TARGET_SECONDS } from "./constants";

export type FileAnalysis = {
  title: string;
  artist: string | null;
  titleSource: "tag" | "filename";
  duration: number;
  suggestedStart: number;
};

export async function analyzeAudioFile(filePath: string, originalFileName: string): Promise<FileAnalysis> {
  const duration = await probeDuration(filePath);

  let title: string;
  let artist: string | null;
  let titleSource: "tag" | "filename";

  const tags = await readTagsSafe(filePath);
  if (tags?.title?.trim()) {
    title = tags.title.trim();
    artist = tags.artist?.trim() || null;
    titleSource = "tag";
  } else {
    const parsed = parseFilename(stripExtension(originalFileName));
    title = parsed.title;
    artist = parsed.artist;
    titleSource = "filename";
  }

  const suggestedStart = await suggestStartTime(filePath, duration);

  return { title, artist, titleSource, duration, suggestedStart };
}

export async function suggestStartTime(filePath: string, duration: number): Promise<number> {
  let suggestedStart = 0;
  if (duration > CLIP_TARGET_SECONDS) {
    try {
      const { samples, sampleRate } = await decodeToPcm(filePath);
      suggestedStart = findChorusStart(samples, sampleRate, duration);
    } catch {
      suggestedStart = 0;
    }
  }

  const maxStart = Math.max(0, duration - Math.min(CLIP_TARGET_SECONDS, duration));
  return Math.min(suggestedStart, maxStart);
}

async function readTagsSafe(filePath: string): Promise<{ title?: string; artist?: string } | null> {
  try {
    const meta = await parseFile(filePath, { duration: false, skipCovers: true });
    const { title, artist } = meta.common;
    if (!title && !artist) return null;
    return { title, artist };
  } catch {
    return null;
  }
}
