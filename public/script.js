/* =========================================================================
   App constants (rename-ready)
   ========================================================================= */
const APP = { name: 'Dripl', ns: 'dripl' }; // soon 'Ameba'
document.getElementById('appName')?.replaceChildren(APP.name);
document.getElementById('heroTitle')?.replaceChildren(APP.name);

const PREFIX = { API_BASE: 'https://dripl.onrender.com' };

/* =========================================================================
   FFmpeg (wasm) bootstrap
   ========================================================================= */
let _ffmpeg = null, _ffmpegLoad = null;

async function getFFmpeg() {
  if (_ffmpeg) return _ffmpeg;
  if (!_ffmpegLoad) {
    _ffmpegLoad = (async () => {
      if (!window.__FFMPEG__?.FFmpeg || !window.__FFMPEG__?.fetchFile) {
        console.warn('[dripl] FFmpeg wasm not present; falling back to metadata-only.');
        return null; // no crash; we’ll still upload original file
      }
      const { FFmpeg, fetchFile } = window.__FFMPEG__;
      const ff = new FFmpeg();
      ff.on('log', ({ message }) => console.log('[ffmpeg]', message));
      ff.on('progress', (p) => {
        document.dispatchEvent(new CustomEvent(`${APP.ns}:transcode-progress`, { detail: p }));
      });
      await ff.load();
      ff.__fetchFile = fetchFile;
      return ff;
    })();
  }
  _ffmpeg = await _ffmpegLoad;
  return _ffmpeg;
}

function normalizeTarget(label) {
  const s = (label || '').toLowerCase();
  return s.includes('mp3') ? 'mp3' : 'mp4';
}
function safeOutputName(original, target) {
  const base = original.replace(/\.[^.]+$/, '');
  return `${base}.${target}`;
}

// script.js (near your ffmpeg init)
async function loadFFmpeg() {
  // 1) try local vendor (fastest, no CDN needed)
  try {
    return await import('/vendor/ffmpeg/ffmpeg.mjs');
  } catch (_) {
    // 2) fall back to CDN if vendor missing
    return await import('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.6/dist/esm/index.js');
  }
}

// Example usage:
let ffmpeg;
(async () => {
  const { createFFmpeg, fetchFile } = await loadFFmpeg();

  ffmpeg = createFFmpeg({
    log: false,
    corePath: '/vendor/ffmpeg/ffmpeg-core.js', // if present locally…
    // If you want to *force* CDN core, comment the line above and use:
    // corePath: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/ffmpeg-core.js'
  });

  await ffmpeg.load();
  // … your transcode pipeline
})();


/* =========================================================================
   Supabase bootstrap (reads from <meta>)
   ========================================================================= */
let supabaseClient = null;
(function initSupabase(){
  const meta = (name) => document.querySelector(`meta[name="${name}"]`)?.content?.trim();
  const url  = meta('supabase-url');
  const anon = meta('supabase-anon');
  if (!window.supabase || !url || !anon) return;

  supabaseClient = window.supabase.createClient(url, anon);

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    window.authToken   = session?.access_token || null;
    window.currentUser = session?.user || null;
    if (session) loadAssetsFromServer?.(); // optional
  });

  // resume session on refresh
  supabaseClient.auth.getSession().then(({ data }) => {
    if (data.session) {
      window.authToken   = data.session.access_token;
      window.currentUser = data.session.user;
      loadAssetsFromServer?.();
    }
  });
})();


/* =========================================================================
   Upload to destination server (progress-capable)
   ========================================================================= */
function uploadFileToServer(fileOrBlob, fileName, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${PREFIX.API_BASE}/api/destination/upload`); // matches server.js

    // include auth if available (Supabase)
    if (window.authToken) xhr.setRequestHeader('Authorization', `Bearer ${window.authToken}`);
    if (window.currentUser?.id) xhr.setRequestHeader('x-ameba-user', window.currentUser.id);

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && typeof onProgress === 'function') {
        onProgress(Math.round((evt.loaded / evt.total) * 100));
      }
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { resolve({ ok: true, raw: xhr.responseText }); }
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.responseText}`));
      }
    };

    const fd = new FormData();
    fd.append('file', fileOrBlob, fileName);
    xhr.send(fd);
  });
}

/* =========================================================================
   Transcode (or fallback) to target format
   ========================================================================= */
async function transcodeFileToTarget(file, target = 'mp4') {
  const ffmpeg = await getFFmpeg();
  if (!ffmpeg) {
    // Fallback: behave as if “converted” without actual transcode.
    return { blob: file, filename: safeOutputName(file.name, target), fallback: true };
  }

  const inputName  = `in_${Date.now()}.${(file.name.split('.').pop() || 'dat')}`;
  const outputName = target === 'mp3' ? 'out.mp3' : 'out.mp4';

  await ffmpeg.writeFile(inputName, await ffmpeg.__fetchFile(file));

  const args =
    target === 'mp3'
      ? ['-i', inputName, '-vn', '-acodec', 'libmp3lame', '-q:a', '4', outputName]
      : ['-i', inputName, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', outputName];

  await ffmpeg.exec(args);

  const data = await ffmpeg.readFile(outputName);
  const blob = new Blob([data], { type: target === 'mp3' ? 'audio/mpeg' : 'video/mp4' });
  return { blob, filename: safeOutputName(file.name, target), fallback: false };
}

/* =========================================================================
   Small utils
   ========================================================================= */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const storageKey = k => `${APP.ns}.${k}`;
function prettyBytes(bytes){ if(!Number.isFinite(bytes)) return ''; const u=['B','KB','MB','GB']; let i=0,v=bytes; while(v>=1024&&i<u.length-1){v/=1024;i++;} return `${v.toFixed(v<10?1:0)} ${u[i]}`; }
const nowISO = () => new Date().toISOString();

/* =========================================================================
   Centralized local-file processing
   ========================================================================= */
async function processLocalFiles(filesList, targetLabel) {
  const target = normalizeTarget(targetLabel || $('#formatSelect')?.value || 'mp4');

  for (const file of filesList) {
    try {
      // 1) transcode (or fallback)
      const { blob, filename, fallback } = await transcodeFileToTarget(file, target);

      // 2) upload to destination (progress optional)
      const uploaded = await uploadFileToServer(blob, filename);

      // 3) hand off to Storage
      document.dispatchEvent(new CustomEvent(`${APP.ns}:converted`, {
        detail: {
          id: crypto.randomUUID(),
          name: filename,
          size: blob.size,
          type: target === 'mp3' ? 'audio' : 'video',
          format: target,
          quality: 'high',
          source: 'local',
          meta: fallback ? 'no-ffmpeg (metadata only)' : '',
          createdAt: nowISO(),
          downloadUrl: uploaded?.url || uploaded?.location || null
        }
      }));
    } catch (err) {
      console.error('[dripl] convert/upload error:', err);
      alert('There was an error converting or uploading one of your files.');
    }
  }
}

/* =========================================================================
   Upload (drag & drop + paste link converter)
   ========================================================================= */
(function initUpload(){
  const drop       = $('#uploadDrop');
  const pasteInput = $('#pasteLink');
  const convertBtn = $('#convertBtn');
  const formatSel  = $('#formatSelect');

  if (drop) {
    // visual states
    ['dragenter','dragover'].forEach(ev => drop.addEventListener(ev, e=>{
      e.preventDefault(); e.dataTransfer.dropEffect='copy'; drop.classList.add('dropzone--over');
    }));
    ['dragleave','drop'].forEach(ev => drop.addEventListener(ev, e=>{
      e.preventDefault(); drop.classList.remove('dropzone--over');
    }));

    drop.addEventListener('drop', async (e)=>{
      const dt = e.dataTransfer;

      // URL/text → treat as paste link conversion
      const link = dt.getData('text/uri-list') || dt.getData('text/plain');
      if (link) {
        pasteInput.value = link.trim();
        convertNow();
        return;
      }

      // Files → unified pipeline
      if (dt.files?.length) await processLocalFiles(Array.from(dt.files), formatSel?.value);
    });
  }

  async function convertNow(){
    const url = (pasteInput?.value || '').trim(); if(!url) return;
    const outFmt = normalizeTarget(formatSel?.value || 'mp4');

    // TODO: your existing paste-link converter call goes here.
    // For now just log it so we keep the UI responsive.
    console.log('[dripl] convert link ->', url, 'to', outFmt);
  }

  convertBtn?.addEventListener('click', convertNow);
  pasteInput?.addEventListener('keydown', (e)=>{ if(e.key==='Enter') convertNow(); });
})();

/* =========================================================================
   Import (choose files + stubs for Dropbox/Drive)
   ========================================================================= */
(function initImport(){
  const chooseBtn = document.getElementById('importChooseBtn');
  const fileInput = document.getElementById('importFileInput');
  const formatSel = document.getElementById('formatSelect');
  if (!chooseBtn || !fileInput) return;

  const openPicker = (e)=>{ e?.preventDefault?.(); setTimeout(()=>fileInput.click(), 0); };
  chooseBtn.addEventListener('click', openPicker);
  chooseBtn.addEventListener('keydown', (e)=>{ if (e.key==='Enter' || e.key===' ') openPicker(e); });

  fileInput.addEventListener('change', async ()=>{
    const files = Array.from(fileInput.files || []);
    if (!files.length) return;
    await processLocalFiles(files, formatSel?.value);
    fileInput.value = ''; // allow same file again later
  });

  document.getElementById('connectDropbox')?.addEventListener('click', ()=>alert('Dropbox SDK not wired yet'));
  document.getElementById('connectDrive')?.addEventListener('click',   ()=>alert('Google Drive Picker not wired yet'));
})();

/* =========================================================================
   Storage (library)
   ========================================================================= */
const DriplStorage = (()=>{
  let items   = load(storageKey('storage.v1')) || [];
  let filters = load(storageKey('filters')) || {};
  let presets = load(storageKey('presets')) || [];
  let folders = load(storageKey('folders')) || [];
  let tab     = 'recent';
  let q       = '';

  const listEl    = $('#storageList');
  const searchEl  = $('#storageSearch');
  const searchClr = $('#storageClearSearch');

  render();

  document.addEventListener(`${APP.ns}:converted`, e=>{
    items.unshift(e.detail);
    save(storageKey('storage.v1'), items);
    render();
  });

  searchEl?.addEventListener('input', ()=>{ q = (searchEl.value || '').trim().toLowerCase(); render(); });
  searchClr?.addEventListener('click', ()=>{ q=''; if (searchEl) searchEl.value=''; render(); });

  $$('#storagePanel .tabs .chip').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      $$('#storagePanel .tabs .chip').forEach(b=>b.classList.remove('chip--active'));
      btn.classList.add('chip--active');
      tab = btn.dataset.tab;
      render();
    });
  });

  hookToolbar();
  return { items, render };

  function render(){
    if(!listEl) return;
    const data = filtered(items);
    listEl.replaceChildren(...data.map(toCard));
  }
  function toCard(it){
    const el = document.createElement('div');
    el.className = 'item';
    el.innerHTML = `
      <div><strong>${escapeHTML(it.name||'unnamed')}</strong></div>
      <div class="item__meta">
        ${it.type||''} • ${it.format||''} • ${prettyBytes(it.size||0)} • ${it.source||''}
      </div>
      <div class="item__meta">Added ${new Date(it.createdAt||Date.now()).toLocaleString()}</div>
      ${it.downloadUrl ? `<div class="item__meta"><a class="btn" href="${it.downloadUrl}" download>Download</a></div>` : ''}
    `;
    return el;
  }
  function filtered(arr){
    let out = arr.filter(it=>{
      const hay = [it.name, it.format, it.source, it.meta].join(' ').toLowerCase();
      return hay.includes(q);
    });
    if(tab==='trash') out = out.filter(it=>it.trashed);
    if(tab==='saved') out = out.filter(it=>it.starred);

    const f = filters;
    if(f.type?.length)     out = out.filter(it=> f.type.includes(it.type));
    if(f.quality?.length)  out = out.filter(it=> f.quality.includes(it.quality));
    if(f.format)           out = out.filter(it=> (it.format||'').includes(f.format.toLowerCase()));
    if(f.source)           out = out.filter(it=> (it.source||'').includes(f.source.toLowerCase()));
    if(f.meta)             out = out.filter(it=> (it.meta||'').toLowerCase().includes(f.meta.toLowerCase()));
    if(f.minSize)          out = out.filter(it=> (it.size||0) >= (+f.minSize*1024*1024));
    if(f.maxSize)          out = out.filter(it=> (it.size||0) <= (+f.maxSize*1024*1024));
    return out;
  }
  function hookToolbar(){
    // Filters
    const btnFilters = $('#btnFilters');
    const panelF     = $('#filterPanel');
    const formF      = $('#filterForm');
    const btnClear   = $('#filterClear');

    btnFilters?.addEventListener('click', ()=> togglePopover(panelF));
    btnClear?.addEventListener('click', ()=>{ filters={}; formF?.reset(); save(storageKey('filters'),filters); render(); });

    $$('#filterPanel .chip[data-key]').forEach(ch=>{
      ch.addEventListener('click', ()=>{
        const key = ch.dataset.key, val = ch.dataset.val;
        ch.classList.toggle('chip--active');
        const list = new Set(filters[key] || []);
        ch.classList.contains('chip--active') ? list.add(val) : list.delete(val);
        filters[key] = Array.from(list);
      });
    });

    formF?.addEventListener('submit', e=>{
      e.preventDefault();
      const fd = new FormData(formF);
      ['format','source','meta','minSize','maxSize'].forEach(k=>{
        const v = (fd.get(k)||'').toString().trim();
        if(v) filters[k] = v; else delete filters[k];
      });
      save(storageKey('filters'),filters);
      hidePopover(panelF);
      render();
    });

    // Presets
    const btnPresets = $('#btnPresets');
    const panelP     = $('#presetPanel');
    const listP      = $('#presetList');
    const nameP      = $('#presetName');
    const saveP      = $('#presetSave');

    btnPresets?.addEventListener('click', ()=>{ renderPresets(); togglePopover(panelP); });
    saveP?.addEventListener('click', ()=>{
      const nm = nameP.value.trim(); if(!nm) return;
      const copy = JSON.parse(JSON.stringify(filters));
      presets.unshift({ id:crypto.randomUUID(), name:nm, filters:copy, createdAt:nowISO() });
      save(storageKey('presets'),presets);
      nameP.value=''; renderPresets();
    });

    function renderPresets(){
      listP.replaceChildren(...presets.map(p=>{
        const row = document.createElement('div'); row.className='row';
        const btn = document.createElement('button'); btn.className='btn'; btn.textContent=p.name;
        btn.addEventListener('click',()=>{
          filters = JSON.parse(JSON.stringify(p.filters));
          save(storageKey('filters'),filters);
          hidePopover(panelP); render();
        });
        const del = document.createElement('button'); del.className='btn btn--ghost'; del.textContent='Delete';
        del.addEventListener('click', ()=>{
          presets = presets.filter(x=>x.id!==p.id);
          save(storageKey('presets'),presets); renderPresets();
        });
        row.append(btn, del);
        return row;
      }));
    }

    // Folders
    const btnFolder = $('#btnAddFolder');
    const panelFo   = $('#folderPanel');
    const nameFo    = $('#folderName');
    const createFo  = $('#folderCreate');

    btnFolder?.addEventListener('click', ()=> togglePopover(panelFo));
    createFo?.addEventListener('click', ()=>{
      const nm = nameFo.value.trim(); if(!nm) return;
      folders.unshift({ id:crypto.randomUUID(), name:nm, createdAt:nowISO() });
      save(storageKey('folders'),folders);
      nameFo.value=''; hidePopover(panelFo);
      alert(`Folder "${nm}" created`);
    });

    // click-away to close any open popover
    document.addEventListener('click', (e)=>{
      [panelF, panelP, panelFo].forEach(p=>{
        if(!p || p.hidden) return;
        const within = p.contains(e.target) || e.target === btnFilters || e.target === btnPresets || e.target === btnFolder;
        if (!within) hidePopover(p);
      });
    });
  }
  function togglePopover(panel){ if (!panel) return; panel.hidden = !panel.hidden; }
  function hidePopover(panel){ if(panel) panel.hidden = true; }
  function save(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
  function load(k){ try{ return JSON.parse(localStorage.getItem(k)||'null'); }catch{ return null; } }
  function escapeHTML(s){ return (s||'').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
})();




































