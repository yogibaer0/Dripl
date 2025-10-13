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
const pasteInput   = document.getElementById('pasteLink');
const formatSelect = document.getElementById('formatSelect');
const convertBtn   = document.getElementById('convertBtn');

async function convertNow() {
  const url = (pasteInput?.value || '').trim();
  const fmt = (formatSelect?.value || 'mp4').toLowerCase();
  if (!url) { alert('Paste a link first 🙂'); return; }

  // (optional) emit “start” so Storage shows it immediately
  const id = crypto.randomUUID();
  window.dispatchEvent(new CustomEvent('dripl:convert:start', {
    detail: { id, name: url, source: inferSource(url), type: 'video', format: fmt }
  }));

  convertBtn.disabled = true;
  const original = convertBtn.textContent;
  convertBtn.textContent = 'Converting…';

  try {
    const res = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, audioOnly: fmt === 'mp3' })
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Server error');

    const blob = await res.blob();
    const ext = fmt === 'mp3' ? 'm4a' : 'mp4';
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `dripl-${Date.now()}.${ext}`
    });
    a.click();

    // (optional) emit “converted” so Storage gets final metadata
    window.dispatchEvent(new CustomEvent('dripl:converted', {
      detail: { id, name: url, source: inferSource(url), type: 'video', format: fmt, outUrl: a.href }
    }));

    pasteInput.value = '';
  } catch (err) {
    alert(`❌ ${err.message || err}`);
  } finally {
    convertBtn.disabled = false;
    convertBtn.textContent = original;
  }
}

// single set of listeners
convertBtn?.addEventListener('click', convertNow);
pasteInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') convertNow(); });

// helper used above
function inferSource(u=''){
  if (u.includes('youtube') || u.includes('youtu.be')) return 'YouTube';
  if (u.includes('tiktok')) return 'TikTok';
  if (u.includes('twitter') || u.includes('x.com')) return 'Twitter';
  return 'Link';
}
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

/* =========================================================
   STORAGE TOOLBAR MODULES
   - One shared store
   - Filters (open/apply/clear)
   - Presets (save/load/delete)
   - Folders (create)
   ========================================================= */

(function storageModules() {
  // ---------- Shared in-memory store ----------
  const Store = {
    items: window.__storageItems || [], // <-- your list renderer reads this
    filters: {
      type: new Set(),    // 'video' | 'audio' | 'image'
      format: '',         // e.g. 'mp4'
      minSize: null,      // MB
      maxSize: null,      // MB
      quality: new Set(), // 'low'|'med'|'high'|'lossless'
      source: '',         // 'youtube','tiktok','local'...
      meta: ''            // any text
    },
    folders: JSON.parse(localStorage.getItem('dripl.folders') || '[]'),
    presets: JSON.parse(localStorage.getItem('dripl.presets') || '{}')
  };

  // Broadcast a “render me” so your existing renderer updates.
  const rerender = () => {
    const ev = new CustomEvent('storage:refresh', { detail: { items: applyFilters(Store.items) } });
    window.dispatchEvent(ev);
  };

  // ---------- Filter application ----------
  function applyFilters(items) {
    const f = Store.filters;
    return items.filter((it) => {
      // safe guards
      const sizeMb = Number((it.sizeMb ?? it.size ?? 0));
      const fmt = (it.format ?? '').toLowerCase();
      const typ = (it.type ?? '').toLowerCase();
      const q   = (it.quality ?? '').toLowerCase();
      const src = (it.source ?? '').toLowerCase();
      const mt  = ((it.tags ?? []).join(' ') + ' ' + (it.notes ?? '') + ' ' + (it.author ?? '')).toLowerCase();

      if (f.type.size && !f.type.has(typ)) return false;
      if (f.quality.size && !f.quality.has(q)) return false;

      if (f.format && !fmt.includes(f.format.toLowerCase())) return false;
      if (f.source && !src.includes(f.source.toLowerCase())) return false;
      if (f.meta && !mt.includes(f.meta.toLowerCase())) return false;

      if (f.minSize != null && sizeMb < f.minSize) return false;
      if (f.maxSize != null && sizeMb > f.maxSize) return false;

      return true;
    });
  }

  // ---------- Small helpers ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const toggleHidden = (el, show) => (show ? el.removeAttribute('hidden') : el.setAttribute('hidden',''));
  const placeUnder = (btnEl, panelEl) => {
    const rect = btnEl.getBoundingClientRect();
    panelEl.style.left = `${rect.left}px`;
    panelEl.style.top  = `${rect.bottom + 8 + window.scrollY}px`;
  };

  // Close any popover when clicking elsewhere
  document.addEventListener('click', (e) => {
    const anyOpen = $$('.popover:not([hidden])');
    if (anyOpen.length === 0) return;
    const inside = e.target.closest('.popover') || e.target.closest('#btnFilters, #btnPresets, #btnAddFolder');
    if (!inside) anyOpen.forEach(p => p.setAttribute('hidden',''));
  });

  // =========================================================
  // ===============  FILTERS ================================
  // =========================================================
  (function filtersModule(){
    const btn = $('#btnFilters');
    const panel = $('#filterPanel');
    const form = $('#filterForm');
    const btnClear = $('#filterClear');

    if (!btn || !panel || !form) return;

    // open/close
    btn.addEventListener('click', () => {
      placeUnder(btn, panel);
      toggleHidden(panel, panel.hasAttribute('hidden'));
      hydrateFormFromFilters();
    });

    // chip toggles
    panel.addEventListener('click', (e) => {
      const chip = e.target.closest('.chipgroup button');
      if (!chip) return;
      chip.classList.toggle('active');
    });

    // clear
    btnClear.addEventListener('click', () => {
      Store.filters = {
        type: new Set(),
        format: '',
        minSize: null,
        maxSize: null,
        quality: new Set(),
        source: '',
        meta: ''
      };
      $$('.chipgroup button', panel).forEach(b => b.classList.remove('active'));
      form.reset();
      rerender();
    });

    // apply
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);

      // build new filters
      const nf = {
        type: new Set(), quality: new Set(),
        format: (fd.get('format') || '').trim(),
        minSize: fd.get('minSize') ? Number(fd.get('minSize')) : null,
        maxSize: fd.get('maxSize') ? Number(fd.get('maxSize')) : null,
        source: (fd.get('source') || '').trim(),
        meta: (fd.get('meta') || '').trim()
      };

      $$('.chipgroup[data-key="type"] button.active', panel).forEach(b => nf.type.add(b.dataset.value));
      $$('.chipgroup[data-key="quality"] button.active', panel).forEach(b => nf.quality.add(b.dataset.value));

      Store.filters = nf;
      toggleHidden(panel, false);
      rerender();
    });

    // Fill form from Store.filters when opening
    function hydrateFormFromFilters(){
      const f = Store.filters;
      form.reset();
      // chips
      $$('.chipgroup[data-key="type"] button', panel).forEach(b => b.classList.toggle('active', f.type.has(b.dataset.value)));
      $$('.chipgroup[data-key="quality"] button', panel).forEach(b => b.classList.toggle('active', f.quality.has(b.dataset.value)));
      // fields
      form.format.value = f.format || '';
      form.minSize.value = f.minSize ?? '';
      form.maxSize.value = f.maxSize ?? '';
      form.source.value = f.source || '';
      form.meta.value = f.meta || '';
    }

    // When new items are added (e.g., conversion done), re-apply filters
    window.addEventListener('storage:itemAdded', (e) => {
      Store.items.unshift(e.detail); // adopt your event payload shape
      rerender();
    });
  })();

  // =========================================================
  // ===============  PRESETS ================================
  // =========================================================
  (function presetsModule(){
    const btn = $('#btnPresets');
    const panel = $('#presetPanel');
    const list = $('#presetList');
    const input = $('#presetName');
    const saveBtn = $('#presetSave');

    if (!btn || !panel) return;

    btn.addEventListener('click', () => {
      placeUnder(btn, panel);
      toggleHidden(panel, panel.hasAttribute('hidden'));
      renderList();
    });

    saveBtn.addEventListener('click', () => {
      const name = (input.value || '').trim();
      if (!name) return;
      // Serialize sets to arrays
      const f = Store.filters;
      const snapshot = {
        ...f,
        type: Array.from(f.type),
        quality: Array.from(f.quality)
      };
      Store.presets[name] = snapshot;
      localStorage.setItem('dripl.presets', JSON.stringify(Store.presets));
      input.value = '';
      renderList();
    });

    function renderList(){
      list.innerHTML = '';
      const names = Object.keys(Store.presets);
      if (names.length === 0){
        list.innerHTML = `<li><em>No presets yet</em></li>`;
        return;
      }
      names.forEach((name) => {
        const li = document.createElement('li');
        const apply = document.createElement('button');
        const del = document.createElement('button');
        li.textContent = name;
        apply.textContent = 'Apply';
        del.textContent = 'Delete';
        apply.addEventListener('click', () => {
          const p = Store.presets[name];
          Store.filters = {
            ...p,
            type: new Set(p.type || []),
            quality: new Set(p.quality || [])
          };
          toggleHidden(panel, false);
          rerender();
        });
        del.addEventListener('click', () => {
          delete Store.presets[name];
          localStorage.setItem('dripl.presets', JSON.stringify(Store.presets));
          renderList();
        });
        const box = document.createElement('div');
        box.append(apply);
        box.append(del);
        li.append(box);
        list.append(li);
      });
    }
  })();

  // =========================================================
  // ===============  FOLDERS ================================
  // =========================================================
  (function foldersModule(){
    const btn = $('#btnAddFolder');
    const panel = $('#folderPanel');
    const inp = $('#folderName');
    const createBtn = $('#folderCreate');

    if (!btn || !panel) return;

    btn.addEventListener('click', () => {
      placeUnder(btn, panel);
      toggleHidden(panel, panel.hasAttribute('hidden'));
      inp.value = '';
      inp.focus();
    });

    createBtn.addEventListener('click', () => {
      const name = (inp.value || '').trim();
      if (!name) return;
      if (!Store.folders.includes(name)){
        Store.folders.push(name);
        localStorage.setItem('dripl.folders', JSON.stringify(Store.folders));
      }
      // Optionally tag selected items to folder here (future)
      toggleHidden(panel, false);
      // Inform any folder UI
      window.dispatchEvent(new CustomEvent('storage:foldersChanged', { detail: { folders: Store.folders }}));
    });
  })();
})();
































