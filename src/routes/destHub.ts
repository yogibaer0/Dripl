import type { Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import { enqueueConvert, convertQ } from '../queue.js';
import { PRESETS } from '../presets.js';
// If you keep meta/thumbnail helpers, import them here.

export function mountDestinationHub(app: import('express').Express) {

  // 1) Start a job
  app.post('/api/convert', async (req: Request, res: Response) => {
    const { fileId, preset } = req.body as { fileId: string, preset: keyof typeof PRESETS };
    if (!fileId || !preset || !PRESETS[preset]) return res.status(400).json({ error: 'bad request' });

    // resolve real paths; these mirror your existing upload layout
    const inputAbs = path.resolve('uploads', fileId, 'source.mp4');     // adapt to your real file naming
    const outAbsDir = path.resolve('uploads', fileId, 'converted');
    const publicBase = `/uploads/${fileId}/converted`;                   // served statically

    try {
      await fs.access(inputAbs);
    } catch {
      return res.status(404).json({ error: 'file not found' });
    }

    const job = await enqueueConvert({ filePath: inputAbs, preset, outDir: outAbsDir, publicBase });
    res.json({ jobId: job.id });
  });

  // 2) Poll job
  app.get('/api/jobs/:id', async (req: Request, res: Response) => {
    const job = await convertQ.getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'not found' });
    const state = await job.getState();
    const progress = job.progress as number || 0;
    const result = (job.returnvalue || {}) as { url?: string };
    res.json({ id: job.id, state, progress, url: result.url });
  });

  // 3) (optional) List presets for the UI
  app.get('/api/presets', (_req, res) => {
    res.json(Object.entries(PRESETS).map(([k,v]) => ({ key:k, label:v.label })));
  });
}
