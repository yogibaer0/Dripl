/* =========================================================================
   App constants (rename-ready)
   ========================================================================= */
const APP = {
  name: 'Dripl',   // soon: 'Ameba'
  ns:   'dripl'    // soon: 'ameba' (used for events/localStorage keys)
};
document.getElementById('appName')?.replaceChildren(APP.name);
document.getElementById('heroTitle')?.replaceChildren(APP.name);

/* =========================================================================
   FFmpeg (wasm) bootstrap
   - We try to use window.__FFMPEG__ = { FFmpeg, fetchFile }
   - If it's not present, we gracefully fall back (still adds to Storage).
   ========================================================================= */
let _ffmpeg = null, _ffmpegLoad = null;

async function getFFmpeg() {
  if (_ffmpeg) return _ffmpeg;
  if (!_ffmpegLoad) {
    _ffmpegLoad = (async () => {
      if (!window.__FFMPEG__?.FFmpeg || !window.__FFMPEG__?.fetchFile) {
        console.warn('[dripl] FFmpeg wasm not present; falling back to metadata-only.');
        return null; // soft fallback: no crash, no transcode
      }
      const { FFmpeg, fetchFile } = window.__FFMPEG__;
      const ff = new FFmpeg();
      ff.on('log', ({ message }) => console.log('[ffmpeg]', message));
      ff.on('progress', (p) => {
        document.dispatchEvent(new CustomEvent('dripl:transcode-progress', { detail: p }));
      });
      await ff.load();
      ff.__fetchFile = fetchFile; // stash helper
      return ff;
    })();
  }
  _ffmpeg = await _ffmpegLoad;
  return _ffmpeg;
}

function normalizeTarget(label) {
  const s = (label || '').toLowerCase();
  if (s.includes('mp3')) return 'mp3';
  return 'mp4';
}

function safeOutputName(original, target) {
  const base = original.replace(/\.[^.]+$/, '');
  return `${base}.${target}`;
}

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
  return { blob, filename: safeOutputName(file.name, target) };
}

/* =========================================================================
   Small utils
   ========================================================================= */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const storageKey = k => `${APP.ns}.${k}`;

function prettyBytes(bytes){
  if(!Number.isFinite(bytes)) return '';
  const u=['B','KB','MB','GB']; let i=0; let v=bytes;
  while(v>=1024 && i<u.length-1){ v/=1024; i++; }
  return `${v.toFixed(v<10?1:0)} ${u[i]}`;
}
const nowISO = () => new Date().toISOString();

/* =========================================================================
   Centralized local-file processing
   - Used by: Upload (drop files), Import (choose files)
   - Emits:  `${APP.ns}:converted` once each item is ready
   ========================================================================= */
async function processLocalFiles(filesList, targetLabel) {
  const target = normalizeTarget(targetLabel || $('#formatSelect')?.value || 'mp4');

  for (const file of filesList) {
   try {
  const { blob, filename } = await transcodeFileToTarget(file, target);
  const publicPath = await uploadToDestinationServer(blob, filename);

  updateStorageItem(item.id, {
    status: 'done',
    name: filename,
    // If you want local preview too:
    // previewUrl: URL.createObjectURL(blob),
    downloadUrl: publicPath               // <-- server URL (hot-linked)
  });
} catch (err) {
  console.error('[ameba] transcode error:', err);
  updateStorageItem(item.id, { status: 'error', error: String(err?.message || err) });
} finally {
  renderStorage();
}


      // Storage listens for this and adds it to “Recent”
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
          downloadUrl
        }
      }));
    } catch (err) {
      console.error('[dripl] transcode error:', err);
      alert('There was an error converting one of your files.');
    }
  }
}

async function uploadToDestinationServer(blob, filename) {
  const fd = new FormData();
  fd.append('file', blob, filename);

  const res = await fetch('http://localhost:8080/api/destinations/upload', {
    method: 'POST',
    body: fd,
    // If you later attach Supabase auth: headers: { Authorization: `Bearer ${window.authToken || ''}` }
  });
  const data = await res.json();
  if (!res.ok || !data?.ok) throw new Error(data?.error || 'Upload failed');
  // Returns server-served URL like /files/123_name.mp4
  return data.url;
}



/* =========================================================================
   Upload (drag & drop + paste link converter)
   ========================================================================= */
(function initUpload(){
  const drop       = $('#uploadDrop');
  const pasteInput = $('#pasteLink');
  const convertBtn = $('#convertBtn');
  const formatSel  = $('#formatSelect');

const xhr = new XMLHttpRequest();
xhr.open("POST", "http://localhost:8080/api/destinations/upload");
if (window.authToken) xhr.setRequestHeader("Authorization", `Bearer ${window.authToken}`);
xhr.send(form);

  if (drop) {
    // Visual state
    ['dragenter','dragover'].forEach(ev => drop.addEventListener(ev, e=>{
      e.preventDefault(); e.dataTransfer.dropEffect='copy'; drop.classList.add('dropzone--over');
    }));
    ['dragleave','drop'].forEach(ev => drop.addEventListener(ev, e=>{
      e.preventDefault(); drop.classList.remove('dropzone--over');
    }));

    drop.addEventListener('drop', async (e)=>{
      const dt = e.dataTransfer;

      // URL or text → treat as paste link conversion
      const link = dt.getData('text/uri-list') || dt.getData('text/plain');
      if (link) {
        pasteInput.value = link.trim();
        convertNow();
        return;
      }

      // REAL files flow -> use FFmpeg + destination
  if (dt.files?.length) {
    await handleDroppedFiles(dt.files);   // <— call the real function
  }
});
  }

  async function convertNow(){
    const url = pasteInput?.value.trim();
    if(!url) return;
    const outFmt = formatSel?.value || 'mp4';

    convertBtn.disabled = true;
    const label = convertBtn.textContent;
    convertBtn.textContent = 'Converting…';

    // Notify storage a conversion was requested (optional hook)
    document.dispatchEvent(new CustomEvent(`${APP.ns}:convert:start`, {
      detail: { url, outFmt, kind:'link' }
    }));

    try{
      // TODO: wire your real server endpoint here.
      // const res = await fetch('/api/download', {...});
      // const data = await res.json();
      await new Promise(r=>setTimeout(r, 600)); // placeholder latency

      document.dispatchEvent(new CustomEvent(`${APP.ns}:converted`, {
        detail: {
          id: crypto.randomUUID(),
          name: `converted.${outFmt}`,
          size: 12 * 1024 * 1024,
          type: outFmt === 'mp3' ? 'audio' : 'video',
          format: outFmt,
          quality: 'high',
          source: (new URL(url)).hostname.replace(/^www\./,''),
          meta: url,
          createdAt: nowISO()
        }
      }));
    }catch(err){
      alert('Link conversion failed.');
      console.error(`[${APP.ns}] convert error`, err);
    }finally{
      convertBtn.disabled = false; convertBtn.textContent = label;
    }
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

  function openPicker(e){ e?.preventDefault?.(); setTimeout(()=>fileInput.click(), 0); }
  chooseBtn.addEventListener('click', openPicker);
  chooseBtn.addEventListener('keydown', (e)=>{ if (e.key==='Enter' || e.key===' ') openPicker(e); });

  // Chosen files → same pipeline as drop
  fileInput.addEventListener('change', async ()=>{
    const files = Array.from(fileInput.files || []);
    if (!files.length) return;
    await processLocalFiles(files, formatSel?.value);
    fileInput.value = ''; // allow same file again later
  });

  // Cloud stubs (wire SDKs later)
  document.getElementById('connectDropbox')?.addEventListener('click', ()=>alert('Dropbox SDK not wired yet'));
  document.getElementById('connectDrive')?.addEventListener('click',   ()=>alert('Google Drive Picker not wired yet'));
})();

/* =========================================================================
   Storage (library) – minimal but functional
   - Listens for `${APP.ns}:converted` and renders "Recent"
   - Includes search, tabs, filters/presets/folders shell you already had
   ========================================================================= */
const DriplStorage = (()=>{

  // state
  let items   = load(storageKey('storage.v1')) || [];
  let filters = load(storageKey('filters')) || {};
  let presets = load(storageKey('presets')) || [];
  let folders = load(storageKey('folders')) || [];
  let tab     = 'recent';
  let q       = '';

  // elements
  const listEl    = $('#storageList');
  const searchEl  = $('#storageSearch');
  const searchClr = $('#storageClearSearch');

  render();

  // accept results from Upload/Import (once complete)
  document.addEventListener(`${APP.ns}:converted`, e=>{
    const item = e.detail;
    items.unshift(item);
    save(storageKey('storage.v1'), items);
    render();
  });

  // search
  searchEl?.addEventListener('input', ()=>{
    q = (searchEl.value || '').trim().toLowerCase();
    render();
  });
  searchClr?.addEventListener('click', ()=>{ q=''; if (searchEl) searchEl.value=''; render(); });

  // tabs
  $$('#storagePanel .tabs .chip').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      $$('#storagePanel .tabs .chip').forEach(b=>b.classList.remove('chip--active'));
      btn.classList.add('chip--active');
      tab = btn.dataset.tab;
      render();
    });
  });

  document.addEventListener('ameba:transcode-progress', (e) => {
  const pct = Math.round((e.detail.ratio || 0) * 100);
  // TODO: find the “inprogress” item in your Storage list and update its DOM
  // e.g., set width of .progress__bar inside that item
});


  // toolbar popovers (filters / presets / folders)
  hookToolbar();

  return { items, render };

  /* ---------- helpers ---------- */

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
    // search
    let out = arr.filter(it=>{
      const hay = [it.name, it.format, it.source, it.meta].join(' ').toLowerCase();
      return hay.includes(q);
    });

    // demo tabs
    if(tab==='trash') out = out.filter(it=>it.trashed);
    if(tab==='saved') out = out.filter(it=>it.starred);

    // filters
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

    btnFilters?.addEventListener('click', ()=> togglePopover(panelF, btnFilters));
    btnClear?.addEventListener('click', ()=>{ filters={}; formF?.reset(); save(storageKey('filters'),filters); render(); });

    // chip toggles
    $$('#filterPanel .chip[data-key]').forEach(ch=>{
      ch.addEventListener('click', ()=>{
        const key = ch.dataset.key;
        const val = ch.dataset.val;
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

    btnPresets?.addEventListener('click', ()=>{ renderPresets(); togglePopover(panelP, btnPresets); });
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

    btnFolder?.addEventListener('click', ()=> togglePopover(panelFo, btnFolder));
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
        const within =
          p.contains(e.target) ||
          e.target === btnFilters || e.target === btnPresets || e.target === btnFolder;
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

async function loadAssetsFromServer() {
  if (!window.authToken) return; // only after login

  const res = await fetch("http://localhost:8080/api/assets", {
    headers: { Authorization: `Bearer ${window.authToken}` }
  });
  const assets = await res.json();

  const storageContainer = document.querySelector('#storageList'); // whatever div shows your cards
  storageContainer.innerHTML = ''; // clear

  assets.forEach(a => {
    const card = document.createElement('div');
    card.className = 'storage-card';
    card.innerHTML = `
      <strong>${a.name}</strong><br>
      ${a.kind} • ${a.format || 'unknown'} • ${(a.size / 1024 / 1024).toFixed(1)} MB<br>
      <small>Added ${new Date(a.created_at).toLocaleString()}</small>
    `;
    storageContainer.appendChild(card);
  });
}



































