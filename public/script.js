/* ===== simple shared state ===== */
const queue = []; // minimal visible queue for demo

/* ===== utilities ===== */
function addToQueue(items) {
  const ul = document.getElementById('uploadList');
  items.forEach(item => {
    queue.push(item);
    const li = document.createElement('li');
    li.className = 'queued__item';
    li.textContent = typeof item === 'string' ? item : item.name;
    ul.appendChild(li);
  });
}

function handleIncoming(files, maybeText) {
  const batch = [];

  // Files
  if (files && files.length) {
    for (const f of files) batch.push(f);
  }

  // Dropped text/URL
  if (maybeText && maybeText.trim()) {
    batch.push(maybeText.trim());
  }

  if (!batch.length) return;
  addToQueue(batch);
}

/* ===== DRAG & DROP (Upload panel only) ===== */
(function initDropzone(){
  const dz = document.getElementById('uploadDropzone');
  if (!dz) return;

  const on = (el, ev, fn) => el.addEventListener(ev, fn);

  const kill = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  ['dragenter','dragover'].forEach(ev => on(dz, ev, (e)=>{
    kill(e);
    dz.classList.add('dropzone--hover');
  }));

  ['dragleave','dragend','drop'].forEach(ev => on(dz, ev, (e)=>{
    kill(e);
    if (ev !== 'drop') dz.classList.remove('dropzone--hover');
  }));

  on(dz, 'drop', (e)=>{
    dz.classList.remove('dropzone--hover');

    const dt = e.dataTransfer;
    const files = dt?.files ?? [];

    // text/URL if any
    let droppedText = '';
    try {
      droppedText =
        dt.getData('text/uri-list') ||
        dt.getData('text/plain') ||
        '';
    } catch(_){ /* ignore */ }

    handleIncoming(files, droppedText);
  });

  // Optional keyboard paste onto dropzone
  on(dz, 'keydown', (e)=>{
    if (e.key === 'Enter' || e.key === ' ') {
      // no-op by design; upload zone is drag-drop only
      e.preventDefault();
    }
  });
})();

/* ===== IMPORT: single working "Choose files" button ===== */
(function initImportPicker(){
  const input = document.getElementById('importFileInput');
  const btn   = document.getElementById('importChooseBtn');
  if (!input || !btn) return;

  btn.addEventListener('click', ()=> input.click());

  input.addEventListener('change', ()=>{
    handleIncoming(input.files);
    // reset so selecting the same file later still fires change
    input.value = '';
  });
})();

/* ===== (Optional) link paste convert stays yours ===== */
(function wireConvert(){
  const convert = document.getElementById('convertBtn');
  const paste   = document.getElementById('pasteInput');
  if (!convert || !paste) return;

  const go = () => {
    const v = paste.value.trim();
    if (v) {
      handleIncoming([], v);
      paste.value = '';
    }
  };
  convert.addEventListener('click', go);
  paste.addEventListener('keydown', (e)=> {
    if (e.key === 'Enter') go();
  });
})();

/* ===== Tiny hero dot runner (unchanged logic you had) ===== */
(function animateDot(){
  const wrap = document.querySelector('.glow-line');
  const svg  = wrap?.querySelector('svg');
  const path = svg?.querySelector('#driplGlowPath');
  const dot  = document.getElementById('glowDot');
  if (!wrap || !svg || !path || !dot) return;

  let len = 0, t = 0, dir = 1;

  function measure(){ len = path.getTotalLength(); }

  function tick(){
    t += dir * 0.0065;
    if (t >= 1) { t = 1; dir = -1; }
    if (t <= 0) { t = 0; dir =  1; }

    const p = path.getPointAtLength(len * t);
    const box = svg.getBoundingClientRect();
    const x = box.left + (p.x / 100) * box.width;
    const y = box.top  + (p.y / 24)  * box.height;

    dot.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;

    requestAnimationFrame(tick);
  }

  const ro = new ResizeObserver(measure);
  ro.observe(svg);
  measure(); tick();
})();






























