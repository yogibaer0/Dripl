/* ========= helpers ========= */
const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

/* ========= drag & drop (Upload) ========= */
(function initDropzone(){
  const dz = $('#dropzone');
  const linkInput = $('#pasteLink');

  const addHover = () => dz.classList.add('dropzone--hover');
  const rmHover  = () => dz.classList.remove('dropzone--hover');

  dz.addEventListener('dragenter', e => { e.preventDefault(); addHover(); });
  dz.addEventListener('dragover',  e => { e.preventDefault(); addHover(); });
  dz.addEventListener('dragleave', e => { e.preventDefault(); rmHover(); });

  dz.addEventListener('drop', async e => {
    e.preventDefault(); rmHover();

    const dt = e.dataTransfer;
    const items = dt && dt.items ? Array.from(dt.items) : [];
    let handled = false;

    // 1) Files
    if (dt && dt.files && dt.files.length){
      handleFiles(dt.files);
      handled = true;
    }

    // 2) Text / URL
    if (!handled && items.length){
      for (const it of items){
        if (it.kind === 'string'){
          it.getAsString(str => {
            const val = (str || '').trim();
            if (val){
              linkInput.value = val;
            }
          });
          handled = true;
          break;
        }
      }
    }
  });

  function handleFiles(files) {
  for (const file of files) {
    const id = crypto.randomUUID();

    // 1️⃣ Start event — Storage sees this and adds to "In Progress"
    window.dispatchEvent(new CustomEvent('dripl:convert:start', {
      detail: {
        id,
        name: file.name,
        source: 'device',
        type: 'video',
        format: 'mp4',
        size: file.size || 0
      }
    }));

    // 2️⃣ Conversion process
    convertFile(file, (percent) => {
      // emit progress if you have it
      window.dispatchEvent(new CustomEvent('dripl:convert:progress', {
        detail: { id, percent }
      }));
    }).then((result) => {
      // 3️⃣ Completion event — Storage moves item to "Recent"
      window.dispatchEvent(new CustomEvent('dripl:converted', {
        detail: {
          id,
          name: file.name,
          format: result.format || 'mp4',
          quality: result.quality || 'auto',
          source: 'device',
          type: 'video',
          size: result.size || file.size,
          outUrl: result.outUrl
        }
      }));
    }).catch((err) => {
      // optional error event
      window.dispatchEvent(new CustomEvent('dripl:convert:error', {
        detail: { id, message: err.message }
      }));
    });
  }
}


// === Paste-link Convert wired to /api/download ===
const pasteInput   = document.getElementById('pasteInput');
const formatSelect = document.getElementById('formatSelect');
const convertBtn   = document.getElementById('convertBtn');

async function convertNow() {
  const url = (pasteInput?.value || '').trim();
  const fmt = (formatSelect?.value || 'mp4').toLowerCase();
  if (!url) { alert('Paste a link first 🙂'); return; }

async function convertLink(url, format) {
  const id = crypto.randomUUID();
  window.dispatchEvent(new CustomEvent('dripl:convert:start', {
    detail: { id, name: url, source: inferSource(url), type: 'video', format }
  }));

  const meta = await callConverterAPI(url, format); // your existing fetch call

  window.dispatchEvent(new CustomEvent('dripl:converted', {
    detail: {
      id,
      name: meta.title || url,
      format,
      quality: meta.quality || 'auto',
      source: inferSource(url),
      type: meta.type || 'video',
      size: meta.size || 0,
      outUrl: meta.outputUrl
    }
  }));
}

  // Optional: a small inline status; remove if you don’t want it
  convertBtn.disabled = true;
  const original = convertBtn.textContent;
  convertBtn.textContent = 'Converting…';

  try {
    const body = { url, audioOnly: fmt === 'mp3' };
    const res = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let msg = 'Unknown server error';
      try { msg = (JSON.parse(text).error || JSON.parse(text).message || msg); } catch {}
      throw new Error(msg);
    }

    const blob = await res.blob();
    const a = document.createElement('a');
    const ext = fmt === 'mp3' ? 'm4a' : 'mp4';
    a.href = URL.createObjectURL(blob);
    a.download = `dripl-${Date.now()}.${ext}`;
    a.click();

    // clear the input on success
    if (pasteInput) pasteInput.value = '';
  } catch (err) {
    alert(`❌ ${err.message || err}`);
    console.error('[dripl] convert error:', err);
  } finally {
    convertBtn.disabled = false;
    convertBtn.textContent = original;
  }
}

if (convertBtn) convertBtn.addEventListener('click', convertNow);
if (pasteInput) pasteInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') convertNow();
});


/* ========= Import (This device) ========= */
(function initImportChooseFiles(){
  const trigger = $('#chooseFilesBtn');
  const input   = $('#hiddenFileInput');

  trigger.addEventListener('click', () => input.click());
  input.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    console.log('Chosen files:', files.map(f => f.name));
    // Pipe into the same place as Upload's files if desired.
  });
})();

/* ========= Import (Dropbox / Drive stubs) ========= */
$('#connectDropbox').addEventListener('click', () => {
  alert('Dropbox integration is not configured yet. Add your SDK key and wire the picker here.');
});
$('#connectDrive').addEventListener('click', () => {
  alert('Google Drive integration is not configured yet. Add your OAuth client + Picker here.');
});

/* ========= Convert quick action ========= */
$('#convertBtn').addEventListener('click', () => quickConvert());
$('#pasteLink').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') quickConvert();
});

function quickConvert(){
  const link = $('#pasteLink').value.trim();
  const fmt  = $('#formatSelect').value;
  if (!link){
    alert('Paste a link or drop files first 🙂');
    return;
  }
  console.log('Convert request:', { link, format: fmt });
  // TODO: call your /api/convert endpoint here.
}

/* ================== Dripl Storage Module ======================= */
(function () {
  const LS_KEY = 'dripl.storage.v1';
  const TRASH_DAYS = 30;

  /** @type {Array<StorageItem>} */
  let state = [];
  let filters = new Set();   // active filter tokens
  let query = '';
  let activeTab = 'recent';

  /** dom refs */
  const $root   = document.getElementById('dripl-storage');
  if (!$root) return; // storage not on this page

  const $search = $root.querySelector('#ds-search');
  const $clear  = $root.querySelector('#ds-clear');

  const $tabs   = Array.from($root.querySelectorAll('.ds-tab'));
  const $panels = Array.from($root.querySelectorAll('.ds-panel'));

  const lists = {
    recent: $root.querySelector('#ds-recent'),
    saved : $root.querySelector('#ds-saved'),
    queue : $root.querySelector('#ds-queue'),
    trash : $root.querySelector('#ds-trash'),
  };

  const $filterBtn = $root.querySelector('#ds-filter-btn');
  const $filterPop = $root.querySelector('#ds-filter-pop');
  const $presetsBtn= $root.querySelector('#ds-presets-btn');
  const $presetsPop= $root.querySelector('#ds-presets-pop');
  const $emptyTrash= $root.querySelector('#ds-empty-trash');

  /* ---------- persistence ---------- */
  function load() {
    try {
      state = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    } catch { state = []; }
    // auto-expire trash
    const now = Date.now();
    const keep = state.filter(i => !(i.status === 'trash' && (now - i.trashedAt) > TRASH_DAYS*864e5));
    if (keep.length !== state.length) {
      state = keep; save();
    }
  }
  function save() {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }

  /* ---------- utils ---------- */
  const el = (sel, ctx = document) => ctx.querySelector(sel);
  const fmt = {
    date: ms => new Date(ms).toLocaleString(),
    size: n => n ? (n>1e9? (n/1e9).toFixed(2)+' GB' : n>1e6? (n/1e6).toFixed(1)+' MB' : Math.round(n/1e3)+' KB') : '—'
  };

  function matchFilters(item) {
    if (!filters.size) return true;
    for (const f of filters) {
      const [k,v] = f.split(':');
      if (k === 'type'    && item.type !== v) return false;
      if (k === 'format'  && item.format !== v) return false;
      if (k === 'source'  && item.source !== v) return false;
      if (k === 'quality' && !item.quality?.includes(v)) return false;
    }
    return true;
  }

  function matchQuery(item) {
    if (!query) return true;
    const q = query.toLowerCase();
    return (item.name?.toLowerCase().includes(q) ||
            item.tags?.join(' ').toLowerCase().includes(q) ||
            item.notes?.toLowerCase().includes(q) ||
            item.source?.toLowerCase().includes(q));
  }

  function byUpdated(a,b){ return (b.updatedAt||0)-(a.updatedAt||0); }

  /* ---------- rendering ---------- */
  function render() {
    const tpl = el('#ds-item-tpl');
    const mount = (listEl, items) => {
      listEl.innerHTML = '';
      if (!items.length) {
        listEl.innerHTML = `<li class="ds-empty">No items yet.</li>`;
        return;
      }
      for (const it of items) {
        const li = tpl.content.firstElementChild.cloneNode(true);
        const name = el('.ds-name', li);
        const meta = el('.ds-meta', li);
        const bar  = el('.ds-progress-bar', li);
        const prog = el('.ds-progress', li);

        name.textContent = it.name || '(untitled)';
        meta.textContent = [
          it.format?.toUpperCase(), it.quality, fmt.size(it.size),
          it.source, fmt.date(it.updatedAt||it.createdAt)
        ].filter(Boolean).join(' • ');

        if (it.status === 'progress') {
          li.classList.add('is-progress');
          bar.style.width = (it.percent||0)+'%';
        }
        if (it.pinned)  li.classList.add('is-pinned');
        if (it.favorite)li.classList.add('is-fav');

        // actions
        li.querySelector('[data-action="trash"]')     .onclick = () => toTrash(it.id);
        li.querySelector('[data-action="favorite"]')  .onclick = () => toggleFav(it.id);
        li.querySelector('[data-action="pin"]')       .onclick = () => togglePin(it.id);
        li.querySelector('[data-action="reconvert"]') .onclick = () => reconvert(it.id);
        li.querySelector('[data-action="locate"]')    .onclick = () => locate(it.id);
        li.querySelector('[data-action="play"]')      .onclick = () => play(it.id);

        listEl.appendChild(li);
      }
    };

    const visible = state.filter(s => matchFilters(s) && matchQuery(s));
    const recent  = visible.filter(s => s.status === 'done').sort(byUpdated);
    const saved   = visible.filter(s => s.favorite && s.status === 'done').sort(byUpdated);
    const queue   = visible.filter(s => s.status === 'progress' || s.status === 'error').sort(byUpdated);
    const trash   = state.filter(s => s.status === 'trash').sort(byUpdated);

    mount(lists.recent, recent);
    mount(lists.saved , saved);
    mount(lists.queue , queue);
    mount(lists.trash , trash);
  }

  /* ---------- mutations & actions ---------- */
  function addItem(partial){
    const now = Date.now();
    const item = {
      id: crypto.randomUUID(),
      name: partial.name || 'Untitled',
      type: partial.type || 'video',      // 'video' | 'audio'
      format: partial.format || 'mp4',
      quality: partial.quality || '',
      size: partial.size || 0,
      source: partial.source || '',
      tags: partial.tags || [],
      notes: partial.notes || '',
      createdAt: now, updatedAt: now,
      status: partial.status || 'done',   // 'done' | 'progress' | 'error' | 'trash'
      percent: partial.percent || 0,
      pinned: !!partial.pinned,
      favorite: !!partial.favorite
    };
    state.unshift(item);
    save(); render();
    return item.id;
  }

  function update(id, patch){
    const i = state.findIndex(x => x.id === id);
    if (i<0) return;
    state[i] = { ...state[i], ...patch, updatedAt: Date.now() };
    save(); render();
  }

  function toTrash(id){ update(id, { status:'trash', trashedAt: Date.now() }); }
  function toggleFav(id){ const it = state.find(s=>s.id===id); if (!it) return; update(id,{favorite:!it.favorite}); }
  function togglePin(id){ const it = state.find(s=>s.id===id); if (!it) return; update(id,{pinned:!it.pinned}); }
  function reconvert(id){ /* stub: wire to your convert flow */ alert('Re-convert queued.'); }
  function locate(id){ /* stub */ alert('Locate not implemented yet'); }
  function play(id){ /* stub */ alert('Play not implemented yet'); }

  function emptyTrash(){
    state = state.filter(s => s.status !== 'trash');
    save(); render();
  }

  /* ---------- events & wiring ---------- */
  $search.addEventListener('input', () => { query = $search.value.trim(); render(); });
  $clear.addEventListener('click', () => { $search.value=''; query=''; render(); });

  $tabs.forEach(btn => btn.addEventListener('click', () => {
    $tabs.forEach(b=>b.classList.remove('is-active'));
    $panels.forEach(p=>p.classList.remove('is-active'));
    btn.classList.add('is-active');
    const panel = btn.dataset.tab;
    activeTab = panel;
    const view = el(`.ds-panel[data-panel="${panel}"]`, $root);
    view?.classList.add('is-active');
  }));

  // menus
  const toggleMenu = (btn, pop) => {
    const wrap = btn.parentElement;
    wrap.classList.toggle('is-open');
    const close = (ev) => {
      if (!wrap.contains(ev.target)) { wrap.classList.remove('is-open'); document.removeEventListener('click', close); }
    };
    setTimeout(()=>document.addEventListener('click', close),0);
  };
  $filterBtn.addEventListener('click', () => toggleMenu($filterBtn,$filterPop));
  $presetsBtn.addEventListener('click', () => toggleMenu($presetsBtn,$presetsPop));

  // filters
  $filterPop.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const token = cb.dataset.filter;
      if (cb.checked) filters.add(token); else filters.delete(token);
      render();
    });
    if (cb.checked) filters.add(cb.dataset.filter);
  });

  // presets (example hook)
  $presetsPop.querySelectorAll('.ds-pop-item').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      alert(`Preset selected: ${btn.dataset.preset}`);
    });
  });

  $emptyTrash?.addEventListener('click', () => {
    if (confirm('Empty trash permanently?')) emptyTrash();
  });

  /* ---------- public API (optional) ---------- */
  window.DriplStorage = {
    add: addItem,
    update,
    toTrash,
    setProgress(id, percent){ update(id, { status:'progress', percent }); },
    markDone(id, extra={}){ update(id, { status:'done', percent:100, ...extra }); },
  };

  /* ---------- init ---------- */
  load(); render();

  // Demo: listen for conversion events (you can dispatch this from Upload/Import on success)
  window.addEventListener('dripl:converted', (e) => {
    const meta = e.detail || {};
    addItem({
      name: meta.name, format: meta.format, quality: meta.quality,
      size: meta.size, source: meta.source, type: meta.type||'video',
      status: 'done'
    });
  });
// === Event listeners for conversions ===
window.addEventListener('dripl:convert:start', (e) => {
  const d = e.detail || {};
  if (!d.id) d.id = crypto.randomUUID();
  window.DriplStorage.add({
    ...d,
    status: 'progress',
    percent: 0
  });
});

window.addEventListener('dripl:convert:progress', (e) => {
  const { id, percent = 0 } = e.detail || {};
  if (id) window.DriplStorage.setProgress(id, percent);
});

})();































