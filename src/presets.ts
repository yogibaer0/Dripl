export type PresetName = 'tiktok'|'instagram-reel'|'twitter'|'reddit'|'youtube';

export const PRESETS: Record<PresetName, {
  label: string;
  vfilters: string[];                 // -vf chain
  vcodec: string; acodec: string;
  container: 'mp4'|'mov'|'webm';
  videoBitrate?: string; audioBitrate?: string; fps?: number; maxDuration?: number;
}> = {
  tiktok: {
    label: 'TikTok (9:16, H.264)',
    vfilters: ['scale=-2:1920:flags=lanczos','fps=30','pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black'],
    vcodec: 'libx264', acodec: 'aac', container: 'mp4', videoBitrate: '4500k', audioBitrate: '128k', fps: 30,
  },
  'instagram-reel': {
    label: 'Instagram Reel (≤90s, 9:16)',
    vfilters: ['scale=-2:1920:flags=lanczos','fps=30','pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black'],
    vcodec: 'libx264', acodec: 'aac', container: 'mp4', videoBitrate: '4500k', audioBitrate: '128k', fps: 30, maxDuration: 90,
  },
  twitter: {
    label: 'Twitter/X (16:9)',
    vfilters: ['scale=1920:-2:flags=lanczos','fps=30','pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black'],
    vcodec: 'libx264', acodec: 'aac', container: 'mp4', videoBitrate: '5000k', audioBitrate: '128k',
  },
  reddit: {
    label: 'Reddit (auto)',
    vfilters: ['scale=1280:-2:flags=lanczos','fps=30'],
    vcodec: 'libx264', acodec: 'aac', container: 'mp4', videoBitrate: '3500k', audioBitrate: '128k',
  },
  youtube: {
    label: 'YouTube 1080p (16:9)',
    vfilters: ['scale=1920:-2:flags=lanczos','fps=30'],
    vcodec: 'libx264', acodec: 'aac', container: 'mp4', videoBitrate: '8000k', audioBitrate: '192k',
  },
};
