import type { Request, Response } from "express";
import { enqueueConvert, type ConvertJobPayload } from "../queue.js";

export async function postConvert(req: Request, res: Response) {
  const body = req.body as Partial<ConvertJobPayload>;
  if (!body?.inputUrl) return res.status(400).json({ error: "inputUrl required" });

  // Normalize body to the agreed shape
  const payload: ConvertJobPayload = {
    inputUrl: body.inputUrl,
    preset: body.preset,
    filePath: body.filePath,
  };

  const job = await enqueueConvert(payload);
  return res.status(202).json({ jobId: job.id });
}
