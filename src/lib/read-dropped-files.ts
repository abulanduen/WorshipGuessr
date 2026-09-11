import { SUPPORTED_AUDIO_EXTENSIONS } from "./constants";

function isAudioFile(name: string): boolean {
  const lower = name.toLowerCase();
  return SUPPORTED_AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

// Minimal shape of the (non-standard but broadly supported) File System Access
// entries used for drag-and-drop folder traversal.
interface FileSystemEntryLike {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file(success: (file: File) => void, error: (err: unknown) => void): void;
  createReader(): { readEntries(success: (entries: FileSystemEntryLike[]) => void, error: (err: unknown) => void): void };
}

async function readAllEntries(reader: ReturnType<FileSystemEntryLike["createReader"]>): Promise<FileSystemEntryLike[]> {
  const all: FileSystemEntryLike[] = [];
  // readEntries must be called repeatedly until it returns an empty array.
  for (;;) {
    const batch = await new Promise<FileSystemEntryLike[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (batch.length === 0) break;
    all.push(...batch);
  }
  return all;
}

async function walk(entry: FileSystemEntryLike, out: File[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => entry.file(resolve, reject));
    if (isAudioFile(file.name)) out.push(file);
    return;
  }
  if (entry.isDirectory) {
    const entries = await readAllEntries(entry.createReader());
    for (const child of entries) await walk(child, out);
  }
}

/**
 * Recursively resolves a drop event's DataTransferItemList into a flat list
 * of audio Files, walking dropped folders via the webkitGetAsEntry API.
 */
export async function getAudioFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
  const items = Array.from(dataTransfer.items);
  const out: File[] = [];

  const hasEntrySupport = items.some(
    (item) => typeof (item as unknown as { webkitGetAsEntry?: unknown }).webkitGetAsEntry === "function"
  );

  if (!hasEntrySupport) {
    // Fallback: flat file list, no folder traversal.
    return Array.from(dataTransfer.files).filter((f) => isAudioFile(f.name));
  }

  const entries = items
    .map((item) => (item as unknown as { webkitGetAsEntry(): FileSystemEntryLike | null }).webkitGetAsEntry())
    .filter((e): e is FileSystemEntryLike => e !== null);

  await Promise.all(entries.map((entry) => walk(entry, out)));
  return out;
}

export function filterAudioFiles(files: File[]): File[] {
  return files.filter((f) => isAudioFile(f.name));
}
