import { spawn } from "node:child_process";
import ffmpegPathRaw from "ffmpeg-static";
import { convertQ, type ConvertJobPayload } from "./queue.js";

const ffmpegPath = ffmpegPathRaw as unknown as string;

/** Very small processor – expand as you wire real presets */
convertQ.process("convert", async (job) => {
  const data: ConvertJobPayload = job.data;
  if (!data.inputUrl) throw new Error("inputUrl required");

  const args = [
    "-y",
    "-i", data.inputUrl,
    // toy preset just to prove execution path
    ...(data.preset === "mp3" ? ["-vn", "-codec:a", "libmp3lame", "-qscale:a", "2"] : []),
    "pipe:1"
  ];

  // Example: run ffmpeg & stream to nowhere just to exercise the worker
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "inherit"] });
    proc.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
  });

  return { ok: true };
});
