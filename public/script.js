/* ================== bootstrap ================== */
const META = (n) => document.querySelector(`meta[name="${n}"]`)?.content?.trim() || "";
const SUPABASE_URL = META("supabase-url");
const SUPABASE_ANON_KEY = META("supabase-anon-key");
const API_BASE = META("api-base") || "";
console.log("[dripl] metas", { SUPABASE_URL, keyPreview: SUPABASE_ANON_KEY?.slice(0,6) + "…" });


// robust UMD loader with fallback + nonce carry-through
async function ensureSupabaseUMD() {
  if (window.supabase) return window.supabase;

  const cdns = [
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js",
    "https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.min.js"
  ];

  const pageNonce = document.querySelector("script[nonce]")?.getAttribute("nonce") || undefined;

  for (const url of cdns) {
    try {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = url;
        if (pageNonce) s.setAttribute("nonce", pageNonce);
        s.async = true;
        s.onload = resolve;
        s.onerror = () => reject(new Error(`load failed: ${url}`));
        document.head.appendChild(s);
      });
      if (window.supabase) return window.supabase;
    } catch (e) {
      console.warn("[dripl] fallback to next CDN:", e.message);
    }
  }
  throw new Error("[dripl] Supabase UMD did not load");
}

(async () => {
  try {
    const supaFactory = await ensureSupabaseUMD();
    window.supa = supaFactory.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.info("[dripl] Supabase ready");
  } catch (err) {
    console.error(err);
  }
})();


if (!window.supabase && !window.Supabase) {
  console.warn('[dripl] supabase UMD not loaded yet');
}
const supa = (window.supabase || window.Supabase)?.createClient?.(SUPABASE_URL, SUPABASE_ANON);

window.authToken = null;
window.currentUser = null;

if (supa?.auth?.onAuthStateChange) {
  supa.auth.onAuthStateChange((event, session) => {
    window.authToken = session?.access_token || null;
    window.currentUser = session?.user || null;
    if (session) {
      try { loadAssetsFromServer?.(); } catch {}
    }
  });
}

/* ==================== DOM refs ==================== */
const $ = (sel, root = document) => root.querySelector(sel);

const drop = $('#uploadDrop');
const pasteInput = $('#pasteLink');
const convertBtn = $('#convertBtn');
const formatSel = $('#formatSelect');

const chooseFilesBtn = $('#chooseFilesBtn');
const hiddenFileInput = $('#hiddenFileInput');

const storageList = $('#storageList');

// Wait for a condition up to timeoutMs
const waitFor = (testFn, { interval = 25, timeoutMs = 3000 } = {}) =>
  new Promise((resolve, reject) => {
    const start = performance.now();
    const tick = () => {
      try {
        const val = testFn();
        if (val) return resolve(val);
        if (performance.now() - start > timeoutMs) return reject(new Error('waitFor timeout'));
        setTimeout(tick, interval);
      } catch (e) { reject(e); }
    };
    tick();
  });

(async () => {
  // Wait for Supabase UMD to be present (loaded by the <script> tag)
  try {
    await waitFor(() => (window.supabase || window.Supabase)?.createClient, { timeoutMs: 5000 });
  } catch {
    console.warn('[dripl] Supabase UMD did not load in time.');
  }

  const supaFactory = (window.supabase || window.Supabase);
  const createClient = supaFactory?.createClient;
  if (createClient) {
    // Read config from <meta> (already in your file)
    const META = (name) => document.querySelector(`meta[name="${name}"]`)?.content?.trim() || '';
    const SUPABASE_URL = META('https://ujchypvlqzermgpfzaqo.supabase.co');
    const SUPABASE_ANON = META('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqY2h5cHZscXplcm1ncGZ6YXFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNzA3NzQsImV4cCI6MjA3NTk0Njc3NH0.WHWxl2VReNQrjlnSlIjyagLpWLex6vmKI0KpXX6_i1w');

    window.supa = createClient(SUPABASE_URL, SUPABASE_ANON);

    // Auth session hook as before…
    window.authToken = null;
    window.currentUser = null;

    window.supa?.auth?.onAuthStateChange?.((event, session) => {
      window.authToken = session?.access_token || null;
      window.currentUser = session?.user || null;
      if (session) {
        try { loadAssetsFromServer?.(); } catch {}
      }
    });
  }
})();


/* ==================== FFmpeg loader ==================== */
async function importFFmpeg() {
  // 1) Try local vendor copy
  try {
    // expects: /public/vendor/ffmpeg/ffmpeg.mjs
    return await import('/vendor/ffmpeg/ffmpeg.mjs');
  } catch {}

  // 2) Fall back to ESM on jsDelivr
  try {
    return await import('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.6/dist/esm/index.js');
  } catch (err) {
    console.warn('[dripl] Could not load FFmpeg ESM. Falling back to metadata-only.', err);
    return null;
  }
}

async function getCoreURL() {
  // Prefer local runtime if you provide it; else CDN core
  try {
    const res = await fetch('/vendor/ffmpeg/ffmpeg-core.js', { method: 'HEAD' });
    if (res.ok) return '/vendor/ffmpeg/ffmpeg-core.js';
  } catch {}
  return 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/ffmpeg-core.js';
}

/* ==================== Helpers ==================== */
function nowISO() { return new Date().toISOString(); }

function addStorageCard(item, { progress } = {}) {
  // Minimal card UI
  const card = document.createElement('div');
  card.className = 'asset-card';

  const metaA = `${item.type} • ${item.format || ''}`.trim();
  const metaB = `${item.size ? Math.round(item.size / (1024 * 1024)) + ' MB' : ''} • ${item.source || ''}`.trim();

  card.innerHTML = `
    <div class="asset-card__inner">
      <div class="asset-card__name">${item.name || 'Unnamed'}</div>
      <div class="asset-card__meta small">${metaA}</div>
      <div class="asset-card__meta small">${metaB}</div>
      <div class="asset-card__foot small">Added ${new Date(item.createdAt || item.created_at || Date.now()).toLocaleString()}</div>
      <div class="asset-card__progress"><div class="bar" style="width:${progress ?? 0}%"></div></div>
    </div>
  `;
  storageList.prepend(card);

  return {
    updateProgress: (p) => {
      const bar = card.querySelector('.bar');
      if (bar) bar.style.width = `${Math.max(0, Math.min(100, p))}%`;
    },
    markDone: () => card.classList.add('is-done'),
  };
}

function mimeFor(ext) {
  const map = {
    mp4: 'video/mp4', mp3: 'audio/mpeg', webm: 'video/webm', wav: 'audio/wav'
  };
  return map[ext] || 'application/octet-stream';
}

/* ==================== Convert / Upload pipeline ==================== */
async function transcodeIfPossible(file, outFormat) {
  // Try FFmpeg; on failure, pass-thru
  const mod = await importFFmpeg();
  if (!mod?.createFFmpeg) return { blob: file, usedFFmpeg: false };

  const coreURL = await getCoreURL();
  const ffmpeg = mod.createFFmpeg({
    coreURL,
    log: false,
  });

  try {
    await ffmpeg.load();

    // Write input
    const inputName = file.name;
    const data = new Uint8Array(await file.arrayBuffer());
    ffmpeg.FS('writeFile', inputName, data);

    // Pick output name/args
    const base = inputName.replace(/\.[^.]+$/, '');
    const out = `${base}.${outFormat}`;

    if (outFormat === 'mp3') {
      await ffmpeg.run('-i', inputName, '-vn', '-b:a', '192k', out);
    } else {
      // MP4 (very fast settings; tweak later)
      await ffmpeg.run(
        '-i', inputName,
        '-c:v', 'libx264', '-preset', 'veryfast',
        '-c:a', 'aac', '-b:a', '128k',
        out
      );
    }

    const outData = ffmpeg.FS('readFile', out);
    const blob = new Blob([outData.buffer], { type: mimeFor(outFormat) });
    return { blob, usedFFmpeg: true };
  } catch (err) {
    console.warn('[dripl] FFmpeg failed; using original file.', err);
    return { blob: file, usedFFmpeg: false };
  } finally {
    try { ffmpeg.exit?.(); } catch {}
  }
}

async function uploadToDestination(blob, filename, onProgress) {
  // POST -> your Render server (Destination Hub)
  const url = `${API_BASE}/api/destination/upload`;

  return new Promise(async (resolve, reject) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);

      if (window.authToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${window.authToken}`);
      }

      // progress
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && typeof onProgress === 'function') {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const json = JSON.parse(xhr.responseText || '{}');
            resolve(json);
          } catch {
            resolve({ ok: true, url: null });
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));

      const form = new FormData();
      form.append('file', new File([blob], filename, { type: blob.type || 'application/octet-stream' }));
      xhr.send(form);
    } catch (err) {
      reject(err);
    }
  });
}

async function handleLocalFile(file, outFmt) {
  const displayName = file.name || 'file';
  const type = (file.type || '').startsWith('audio') ? 'audio' : 'video';

  const card = addStorageCard({
    id: crypto.randomUUID(),
    name: displayName,
    size: file.size,
    type,
    format: outFmt,
    source: 'local',
    createdAt: nowISO(),
  }, { progress: 0 });

  try {
    // 1) (Try) transcode
    const { blob } = await transcodeIfPossible(file, outFmt);
    // 2) Upload
    const res = await uploadToDestination(
      blob, displayName.replace(/\.[^.]+$/, `.${outFmt}`),
      (p) => card.updateProgress(p)
    );
    card.updateProgress(100);
    card.markDone();
    // 3) Inform storage list if server returns a URL
    if (res?.url) {
      const a = document.createElement('a');
      a.href = res.url; a.target = '_blank';
      a.textContent = 'Open';
      const wrap = document.createElement('div');
      wrap.className = 'asset-card__actions';
      wrap.appendChild(a);
      storageList.firstElementChild?.appendChild(wrap);
    }
  } catch (err) {
    alert('There was an error converting or uploading one of your files.');
    console.error('[dripl] convert/upload error:', err);
  }
}

async function convertNow() {
  const url = pasteInput.value.trim();
  if (!url) return;

  const outFmt = formatSel.value;
  const btn = convertBtn;
  const original = btn.textContent;
  btn.disabled = true; btn.textContent = 'Converting…';

  // Links: let backend handle (ytdlp, etc.)
  try {
    const res = await fetch(`${API_BASE}/api/destination/convert-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(window.authToken ? { 'Authorization': `Bearer ${window.authToken}` } : {})
      },
      body: JSON.stringify({ url, out: outFmt })
    });
    if (!res.ok) throw new Error(`Link convert failed: ${res.status}`);
    const json = await res.json();

    addStorageCard({
      id: json?.id || crypto.randomUUID(),
      name: json?.name || (new URL(url).hostname),
      size: json?.size || 0,
      type: json?.type || (outFmt === 'mp3' ? 'audio' : 'video'),
      format: outFmt,
      source: json?.source || 'link',
      createdAt: nowISO(),
    }, { progress: 100 }).markDone();

  } catch (err) {
    alert('There was an error converting your link.');
    console.error('[dripl] convert link error:', err);
  } finally {
    btn.disabled = false; btn.textContent = original;
  }
}

/* ==================== Events ==================== */
// Drag-over UX
['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => {
  e.preventDefault(); drop.classList.add('dropzone--over');
}));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
  e.preventDefault(); drop.classList.remove('dropzone--over');
}));

// Drop handler
drop.addEventListener('drop', async (e) => {
  const dt = e.dataTransfer;

  // If a link was dropped
  const link = dt.getData('text/uri-list') || dt.getData('text/plain');
  if (link && /^https?:\/\//i.test(link.trim())) {
    pasteInput.value = link.trim();
    convertNow();
    return;
  }

  // Files
  if (dt.files?.length) {
    const outFmt = formatSel.value;
    for (const f of dt.files) {
      await handleLocalFile(f, outFmt);
    }
  }
});

// Buttons/inputs
if (convertBtn) convertBtn.addEventListener('click', convertNow);
if (pasteInput) pasteInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') convertNow();
});

if (chooseFilesBtn && hiddenFileInput) {
  chooseFilesBtn.addEventListener('click', () => hiddenFileInput.click());
  hiddenFileInput.addEventListener('change', async (e) => {
    const outFmt = formatSel.value;
    const files = Array.from(e.currentTarget.files || []);
    for (const f of files) await handleLocalFile(f, outFmt);
    hiddenFileInput.value = '';
  });
}

/* ==================== Optional: storage loader ==================== */
async function loadAssetsFromServer() {
  // Implement if your backend serves recent assets
  // Example:
  try {
    const res = await fetch(`${API_BASE}/api/destination/recent`, {
      headers: window.authToken ? { Authorization: `Bearer ${window.authToken}` } : {}
    });
    if (!res.ok) return;
    const list = await res.json();
    for (const a of list || []) {
      addStorageCard(a, { progress: 100 }).markDone();
    }
  } catch {}
}





































