import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "ffprobe-static";

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
if (ffprobePath?.path) ffmpeg.setFfprobePath(ffprobePath.path);

export function probeDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      const duration = data?.format?.duration;
      if (typeof duration !== "number" || Number.isNaN(duration)) {
        return reject(new Error("Could not determine audio duration"));
      }
      resolve(duration);
    });
  });
}

const PCM_SAMPLE_RATE = 8000;

/**
 * Decodes the whole file to mono 16-bit PCM at a low sample rate purely for
 * loudness analysis (not for playback), keeping the buffer small.
 */
export function decodeToPcm(filePath: string): Promise<{ samples: Int16Array; sampleRate: number }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    ffmpeg(filePath)
      .noVideo()
      .audioChannels(1)
      .audioFrequency(PCM_SAMPLE_RATE)
      .format("s16le")
      .on("error", (err) => reject(err))
      .on("end", () => {
        const buf = Buffer.concat(chunks);
        const samples = new Int16Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 2));
        resolve({ samples, sampleRate: PCM_SAMPLE_RATE });
      })
      .pipe()
      .on("data", (chunk: Buffer) => chunks.push(chunk));
  });
}

export type TrimOptions = {
  inputPath: string;
  outputPath: string;
  startSeconds: number;
  durationSeconds: number;
};

export function trimAndEncode({ inputPath, outputPath, startSeconds, durationSeconds }: TrimOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(Math.max(0, startSeconds))
      .duration(durationSeconds)
      .audioCodec("aac")
      .audioBitrate("112k")
      .audioChannels(2)
      .outputOptions(["-movflags +faststart", "-ac 2"])
      .format("mp4")
      .on("error", (err) => reject(err))
      .on("end", () => resolve())
      .save(outputPath);
  });
}
