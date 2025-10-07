/* Dripl scaffold: simple state & wiring (no conversions yet) */

const Dripl = (() => {
  const state = {
    sourceUrl: '',
    files: [],
    format: 'mp4',
    qualityStep: 2,    // 0..3
    bitrate: 'Auto',
    destination: null,
    storage: null
  };

  const el = (sel) => document.querySelector(sel);

  // Source link form
  const sourceForm = el('#sourceForm');
  const sourceInput = el('#sourceUrl');

  if (sourceForm){
    sourceForm.addEventListener('submit', (e) => {
      e.preventDefault();
      state.sourceUrl = (sourceInput.value || '').trim();
      if (!state.sourceUrl) return;
      // Visual ping of HUB to show the source attached (placeholder)
      pulseHub();
    });
  }

  // Upload
  const fileInput = el('#fileInput');
  const browseBtn = el('#browseBtn');
  const dropUpload = el('#dropUpload');
  const uploadList = el('#uploadList');

  if (browseBtn && fileInput){
    browseBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => handleFiles(fileInput.files));
  }
  if (dropUpload){
    dropUpload.addEventListener('dragover', (e)=>{ e.preventDefault(); dropUpload.classList.add('is-over'); });
    dropUpload.addEventListener('dragleave', ()=> dropUpload.classList.remove('is-over'));
    dropUpload.addEventListener('drop', (e)=>{
      e.preventDefault();
      dropUpload.classList.remove('is-over');
      handleFiles(e.dataTransfer.files);
    });
  }

  function handleFiles(fileList){
    if (!fileList || !fileList.length) return;
    state.files = [...state.files, ...Array.from(fileList)];
    renderUploads();
    pulseHub();
  }

  function renderUploads(){
    if (!uploadList) return;
    uploadList.innerHTML = '';
    state.files.slice(0,6).forEach(f => {
      const li = document.createElement('li');
      li.textContent = `${f.name} (${Math.round(f.size/1024)} KB)`;
      uploadList.appendChild(li);
    });
    if (state.files.length > 6){
      const li = document.createElement('li');
      li.textContent = `+${state.files.length - 6} more…`;
      uploadList.appendChild(li);
    }
  }

  // Filetype + Quality
  const formatRadios = document.querySelectorAll('input[name="format"]');
  formatRadios.forEach(r => r.addEventListener('change', ()=> {
    state.format = document.querySelector('input[name="format"]:checked').value;
  }));

  const qualityRange = el('#qualityRange');
  const bitrateSelect = el('#bitrateSelect');
  if (qualityRange) qualityRange.addEventListener('input', ()=> state.qualityStep = +qualityRange.value);
  if (bitrateSelect) bitrateSelect.addEventListener('change', ()=> state.bitrate = bitrateSelect.value);

  // Footer convert (stub -> pipeline state)
  const convertUrl = el('#convertUrl');
  const convertFormat = el('#convertFormat');
  const convertBtn = el('#convertBtn');

  if (convertBtn){
    convertBtn.addEventListener('click', ()=>{
      const url = (convertUrl.value || state.sourceUrl || '').trim();
      const fmt = convertFormat.value || state.format;
      if (!url && !state.files.length){
        alert('Add a source link or upload files first.');
        return;
      }
      // In the next step we’ll call backend here.
      console.log('[Dripl] Convert request', {
        url, files: state.files, fmt,
        quality: state.qualityStep, bitrate: state.bitrate
      });
      pulseHub();
    });

    convertUrl.addEventListener('keydown', (e)=>{
      if (e.key === 'Enter'){ e.preventDefault(); convertBtn.click(); }
    });
  }

  function pulseHub(){
    const hub = document.getElementById('hub');
    if (!hub) return;
    hub.classList.remove('pulse');
    // force reflow to restart animation
    void hub.offsetWidth;
    hub.classList.add('pulse');
    setTimeout(()=> hub.classList.remove('pulse'), 700);
  }

  return { state };
})();
/* ---------- Tabs: Upload / Import / Storage ---------- */
(function tabs(){
  const groups = Array.from(document.querySelectorAll('.collapsible[data-tab]'));
  if (!groups.length) return;

  // open tab by id/name
  function openTab(name, pushHash = true){
    groups.forEach(sec => {
      const isMatch = sec.dataset.tab === name;
      sec.classList.toggle('is-open', isMatch);
      sec.setAttribute('aria-expanded', String(isMatch));
    });
    if (pushHash) {
      // update URL hash so /#upload deep-links; avoid polluting history when first loading
      const target = name ? `#${name}` : ' ';
      history.replaceState(null, '', target);
    }
  }

  // click handlers
  groups.forEach(sec => {
    const btn = sec.querySelector('.tab-btn');
    if (!btn) return;
    btn.addEventListener('click', () => openTab(sec.dataset.tab));
    // allow clicking the whole header row as a target
    sec.querySelector('.blob__title')?.addEventListener('click', (e)=>{
      if (e.target.closest('.tab-btn')) return; // already handled
      openTab(sec.dataset.tab);
    });
  });

  // open from hash on load
  const boot = (location.hash || '').replace('#','').trim();
  if (boot && groups.some(s => s.dataset.tab === boot)){
    openTab(boot, false);
  } else {
    // default open: upload (change to whatever you want)
    openTab('upload', false);
  }

  // allow manual hash change to switch tabs
  window.addEventListener('hashchange', ()=>{
    const h = (location.hash || '').replace('#','').trim();
    if (h) openTab(h, false);
  });
})();

















