// server/server.js (CommonJS)
const express = require('express');
const multer  = require('multer');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

// ---- Local disk "bucket" (simple, reliable) ----
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'server_out');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`),
});
const upload = multer({ storage });

const app = express();
app.use(cors());
app.use(express.json());

// POST /api/destinations/upload  (multipart/form-data: file)
// returns { ok, url, name, size }
app.post('/api/destinations/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'No file' });
    const publicUrl = `/files/${req.file.filename}`;
    return res.status(201).json({
      ok: true,
      url: publicUrl,
      name: req.file.originalname,
      size: req.file.size,
      type: req.file.mimetype,
    });
  } catch (err) {
    console.error('upload error:', err);
    return res.status(500).json({ ok: false, error: 'Upload failed' });
  }
});

// Serve stored files (dev/debug)
app.use('/files', express.static(UPLOAD_DIR));

// Health check
app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Destination server running on http://localhost:${PORT}`);
  console.log(`Files directory: ${UPLOAD_DIR}`);
});
