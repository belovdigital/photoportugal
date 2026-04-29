import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, readFile } from "fs/promises";
import path from "path";
import os from "os";
import crypto from "crypto";

const execFileP = promisify(execFile);

export interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
  thumbnailBuffer: Buffer;
}

/**
 * Run a fresh upload buffer through ffprobe (for dimensions + duration) and
 * ffmpeg (extract a single frame ~1s in for the poster thumbnail). The
 * thumbnail is JPEG, max 1280px wide, ready to upload to R2 next to the
 * original video.
 *
 * Both binaries are expected on PATH — they ship in the `ffmpeg` apt
 * package on the deployment box.
 *
 * Memory: callers pass the entire video buffer in. We dump it to a temp
 * file because ffmpeg/ffprobe operate on file paths; the temp gets cleaned
 * up in finally{} regardless of success.
 */
export async function processVideoUpload(buffer: Buffer, originalFilename: string): Promise<VideoMetadata> {
  const tmpDir = os.tmpdir();
  const id = crypto.randomUUID();
  const safeBase = originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 40);
  const tmpVideo = path.join(tmpDir, `vid_${id}_${safeBase}`);
  const tmpThumb = path.join(tmpDir, `thumb_${id}.jpg`);

  try {
    await writeFile(tmpVideo, buffer);

    // 1. Probe metadata
    const { stdout: probeOut } = await execFileP("ffprobe", [
      "-v", "error",
      "-show_entries", "stream=width,height,codec_type:format=duration",
      "-of", "json",
      tmpVideo,
    ]);
    const probe = JSON.parse(probeOut) as {
      streams?: { width?: number; height?: number; codec_type?: string }[];
      format?: { duration?: string };
    };
    const videoStream = probe.streams?.find((s) => s.codec_type === "video");
    const width = videoStream?.width ?? 0;
    const height = videoStream?.height ?? 0;
    const duration = Math.max(0, Math.round(parseFloat(probe.format?.duration ?? "0")));

    // 2. Extract thumbnail. Seek to ~1s in (or middle if shorter); use a
    //    high-quality JPEG capped at 1280px wide so the poster looks
    //    crisp on retina mobile but stays small.
    const seekTime = duration > 2 ? "1.0" : Math.max(0.1, duration / 2).toFixed(2);
    await execFileP("ffmpeg", [
      "-y",
      "-ss", seekTime,
      "-i", tmpVideo,
      "-frames:v", "1",
      "-q:v", "3",
      "-vf", "scale='min(1280,iw)':-2",
      tmpThumb,
    ]);

    const thumbnailBuffer = await readFile(tmpThumb);
    return { width, height, duration, thumbnailBuffer };
  } finally {
    await unlink(tmpVideo).catch(() => {});
    await unlink(tmpThumb).catch(() => {});
  }
}
