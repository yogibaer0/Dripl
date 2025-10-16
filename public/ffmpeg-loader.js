// public/ffmpeg-loader.js
// Load local ESM builds and expose them for script.js
import { FFmpeg }   from './vendor/ffmpeg/ffmpeg.mjs';
import { fetchFile } from './vendor/ffmpeg/util.mjs';

window.__FFMPEG__ = { FFmpeg, fetchFile };
