import { spawn } from 'node:child_process';
import { PRESETS, PresetName } from './presets.js';
import path from 'node:path';

export function ffmpeg(args: string[], onProgress?: (p: number)=>void): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore','pipe','pipe'] });
    // simple % progress parser (optional)
    proc.stderr.on('data', buf => {
      const s = String(buf);
      const m = s.match(/time=(\d+):(\d+):(\d+\.\d+)/);
      if (m && onProgress) {
        const [ , hh, mm, ss ] = m;
        const cur = (+hh)*3600 + (+mm)*60 + (+ss);
        onProgress(Math.min(99, Math.round(cur))); // crude but good enough
      }
    });
    proc.on('exit', code => code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`)));
  });
}

export async function runPreset(inputPath: string, preset: PresetName, outDir: string, onProgress?: (p: number)=>void) {
  const P = PRESETS[preset];
  const outPath = path.join(outDir, `${preset}.${P.container}`);
  const args = [
    '-y','-i', inputPath,
    ...(P.maxDuration ? ['-t', String(P.maxDuration)] : []),
    '-vf', P.vfilters.join(','),
    '-c:v', P.vcodec,
    ...(P.videoBitrate ? ['-b:v', P.videoBitrate] : []),
    ...(P.fps ? ['-r', String(P.fps)] : []),
    '-c:a', P.acodec,
    ...(P.audioBitrate ? ['-b:a', P.audioBitrate] : []),
    '-movflags', '+faststart',
    outPath
  ];
  await ffmpeg(args, onProgress);
  return outPath;
}
