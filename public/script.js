/* =========================================================================
   App constants (rename-ready)
   ========================================================================= */
const APP = {
  name: 'Dripl',     // later: 'Ameba'
  ns:   'dripl'      // later: 'ameba'  (used in localStorage keys + events)
};

// reflect brand in UI (safe if HTML shows old name)
document.getElementById('appName')?.replaceChildren(APP.name);
document.getElementById('heroTitle')?.replaceChildren(APP.name);

/* =========================================================================
   Small utils
   ========================================================================= */
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const storageKey = k => `${APP.ns}.${k}`;

function prettyBytes(bytes){
  if(!Number.isFinite(bytes)) return '';
  const u=['B','KB','MB','GB']; let i=0; let v=bytes;
  while(v>=1024 && i<u.length-1){ v/=1024; i++; }
  return `${v.toFixed(v<10?1:0)} ${u[i]}`;
}
function nowISO(){ return new Date().toISOString(); }

/* =========================================================================
   Upload (drag & drop + paste link converter)
   ========================================================================= */
(function initUpload(){
  const drop = $('#uploadDrop');
  const pasteInput = $('#pasteLink');
  const convertBtn = $('#convertBtn');
  const formatSel  = $('#formatSelect');

  // drag-over styling
  ['dragenter','dragover'].forEach(ev => drop.addEventListener(ev, e=>{
    e.preventDefault(); e.dataTransfer.dropEffect='copy'; drop.classList.add('dropzone--over');
  }));
  ['dragleave','drop'].forEach(ev => drop.addEventListener(ev, e=>{
    e.preventDefault(); drop.classList.remove('dropzone--over');
  }));

  drop.addEventListener('drop', async (e)=>{
    const dt = e.dataTransfer;

    // URLs or plain text → treat as paste link conversion
    const link = dt.getData('text/uri-list') || dt.getData('text/plain');
    if(link){
      pasteInput.value = link.trim();
      convertNow(); return;
    }

    // Files → queue each to storage immediately
    if(dt.files?.length){
      for(const f of dt.files){
        dispatchConvertStart({ name:f.name, size:f.size, kind:'file' });
        // Simulate success (your real uploader goes here)
        dispatchConverted({
          id: crypto.randomUUID(),
          name: f.name,
          size: f.size,
          type: (f.type||'').startsWith('audio') ? 'audio' : 'video',
          format: (f.name.split('.').pop()||'').toLowerCase(),
          quality: 'high',
          source: 'local',
          meta: '',
          createdAt: nowISO()
        });
      }
    }
  });

  async function convertNow(){
    const url = pasteInput.value.trim();
    if(!url) return;
    const outFmt = formatSel.value;

    convertBtn.disabled = true;
    const label = convertBtn.textContent;
    convertBtn.textContent = 'Converting…';

    dispatchConvertStart({ url, outFmt, kind:'link' });

    try{
      // Replace with your real API
      // const res = await fetch('/api/download', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ url, format: outFmt })});
      // const data = await res.json();
      await new Promise(r=>setTimeout(r, 800));

      dispatchConverted({
        id: crypto.randomUUID(),
        name: `converted.${outFmt}`,
        size: 12 * 1024 * 1024,
        type: outFmt === 'mp3' ? 'audio' : 'video',
        format: outFmt,
        quality: 'high',
        source: (new URL(url)).hostname.replace('www.',''),
        meta: url,
        createdAt: nowISO()
      });
    }catch(err){
      alert(`Conversion error`);
      console.error(`[${APP.ns}] convert error`, err);
    }finally{
      convertBtn.disabled = false; convertBtn.textContent = label;
    }
  }

  convertBtn?.addEventListener('click', convertNow);
  pasteInput?.addEventListener('keydown', (e)=>{ if(e.key==='Enter') convertNow(); });

  // helper events for Storage
  function dispatchConvertStart(payload){
    document.dispatchEvent(new CustomEvent(`${APP.ns}:convert:start`,{detail:payload}));
  }
  function dispatchConverted(item){
    document.dispatchEvent(new CustomEvent(`${APP.ns}:converted`,{detail:item}));
  }
})();

/* =========================================================================
   Import (choose files + stubs for cloud) — robust
   ========================================================================= */
(function initImport(){
  const chooseBtn = document.getElementById('importChooseBtn');
  const fileInput = document.getElementById('importFileInput');

  if (!chooseBtn || !fileInput) {
    console.warn('[import] missing elements', { chooseBtn: !!chooseBtn, fileInput: !!fileInput });
    return;
  }

  // Ensure input is usable
  fileInput.disabled = false;

  // Open the system file chooser
  function openPicker(e){
    e?.preventDefault?.();
    // Some browsers need a tiny delay to ensure focus is not on a <button type=submit>
    setTimeout(()=> fileInput.click(), 0);
  }

  // Click & keyboard activation
  chooseBtn.addEventListener('click', openPicker);
  chooseBtn.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter' || e.key === ' ') openPicker(e);
  });

  // Handle chosen files
  fileInput.addEventListener('change', ()=>{
    const files = Array.from(fileInput.files || []);
    if (!files.length) return;

    files.forEach(f=>{
      document.dispatchEvent(new CustomEvent(`${APP.ns}:converted`, {
        detail: {
          id: crypto.randomUUID(),
          name: f.name,
          size: f.size,
          type: (f.type || '').startsWith('audio') ? 'audio' : 'video',
          format: (f.name.split('.').pop() || '').toLowerCase(),
          quality: 'high',
          source: 'device',
          meta: '',
          createdAt: new Date().toISOString()
        }
      }));
    });

    // Reset input so selecting the same file later still fires 'change'
    fileInput.value = '';
  });

  // (Optional) Guard: if something ever overlays the button, log it
  setTimeout(()=>{
    const rect = chooseBtn.getBoundingClientRect();
    const el = document.elementFromPoint(rect.left + 4, rect.top + 4);
    if (el && el !== chooseBtn && !chooseBtn.contains(el)) {
      console.warn('[import] Something may overlay the Choose files button:', el);
    }
  }, 0);

  // Stubs (wire SDKs later)
  document.getElementById('connectDropbox')?.addEventListener('click', ()=>alert('Dropbox SDK not wired yet'));
  document.getElementById('connectDrive')?.addEventListener('click',   ()=>alert('Google Drive Picker not wired yet'));
})();


/* =========================================================================
   Storage (library)
   ========================================================================= */
const DriplStorage = (()=>{

  // state
  let items = load(storageKey('storage.v1')) || [];     // all entries
  let filters = load(storageKey('filters')) || {};      // last filters used
  let presets = load(storageKey('presets')) || [];      // saved presets
  let folders = load(storageKey('folders')) || [];      // folder names
  let tab = 'recent';                                   // recent | saved | queue | shared | trash
  let q = '';                                           // search query

  // elements
  const listEl    = $('#storageList');
  const searchEl  = $('#storageSearch');
  const searchClr = $('#storageClearSearch');

  // Initial render
  render();

  // ——— convert events coming from Upload/Import ———
  document.addEventListener(`${APP.ns}:convert:start`, e=>{
    const p = e.detail||{};
    // you may show queue items here if desired
  });

  document.addEventListener(`${APP.ns}:converted`, e=>{
    const item = e.detail;
    items.unshift(item);
    save(storageKey('storage.v1'), items);
    render();
  });

  // ——— search ———
  searchEl?.addEventListener('input', ()=>{
    q = (searchEl.value||'').trim().toLowerCase();
    render();
  });
  searchClr?.addEventListener('click', ()=>{
    q=''; searchEl.value=''; render();
  });

  // ——— tabs ———
  $$('#storagePanel .tabs .chip').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      $$('#storagePanel .tabs .chip').forEach(b=>b.classList.remove('chip--active'));
      btn.classList.add('chip--active');
      tab = btn.dataset.tab;
      render();
    });
  });

  // ——— toolbar popovers ———
  hookToolbar();

  // public API (optional)
  return { items, render };

  /* ----------------------- helpers ----------------------- */

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
    `;
    return el;
  }

  function filtered(arr){
    // search
    let out = arr.filter(it=>{
      const hay = [
        it.name, it.format, it.source, it.meta
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });

    // demo tabs (extend as needed)
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
    btnClear?.addEventListener('click', ()=>{ filters={}; formF.reset(); save(storageKey('filters'),filters); render(); });

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

    btnPresets?.addEventListener('click', ()=>{
      renderPresets(); togglePopover(panelP, btnPresets);
    });
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

    // clicking outside closes any open popover
    document.addEventListener('click', (e)=>{
      [panelF,panelP,panelFo].forEach(p=>{
        if(!p || p.hidden) return;
        if(!p.contains(e.target) && e.target !== btnFilters && e.target !== btnPresets && e.target !== btnFolder){
          hidePopover(p);
        }
      });
    });
  }

  function togglePopover(panel, anchor){
    if(!panel) return;
    panel.hidden = !panel.hidden;
    if(!panel.hidden){
      // simple position near right edge; could calculate from anchor if wanted
      panel.style.right = '18px'; panel.style.bottom = '18px';
    }
  }
  function hidePopover(panel){ if(panel) panel.hidden=true; }

  function save(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
  function load(k){ try{ return JSON.parse(localStorage.getItem(k)||'null'); }catch{ return null; } }

  function escapeHTML(s){ return (s||'').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
})();

































