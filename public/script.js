/* =========================================================
   DRIPL — Upload: reliable picker + drag&drop + URL queue
   Drop this in: public/script.js
========================================================= */

/* ---------- tiny helpers ---------- */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);

/* ---------- elements (optional if absent) ---------- */
const dropzone     = $('#dropzone');
const fileInput    = $('#fileInput');          // <input type="file" multiple hidden>
const browseBtn    = $('#browseBtn');          // has [data-browse] but we bind both
const queueEl      = $('#uploadQueue');        // <ul>
const pasteInput   = $('#pasteInput');         // <input type="url">
const formatSelect = $('#formatSelect');       // <select>
const convertBtn   = $('#convertBtn');         // <button>

/* ---------- state ---------- */
const uploadQueue = []; // items: { type:'file'|'url', name?:string, file?:File, url?:string }

/* ---------- utils ---------- */
function isProbablyUrl(text) {
  if (!text || typeof text !== 'string') return false;
  try {
    const url = new URL(text.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function renderQueue() {
  if (!queueEl) return;
  queueEl.innerHTML = '';
  uploadQueue.forEach((item, i) => {
    const li    = document.createElement('li');
    const kind  = document.createElement('span');
    const label = document.createElement('span');
    const rm    = document.createElement('button');

    kind.className  = 'badge';
    kind.textContent = item.type.toUpperCase();

    label.textContent = item.type === 'file' ? item.name : item.url;

    rm.className = 'btn';
    rm.style.marginLeft = 'auto';
    rm.textContent = 'Remove';
    rm.onclick = () => { uploadQueue.splice(i, 1); renderQueue(); };

    li.append(kind, label, rm);
    queueEl.appendChild(li);
  });
}

function enqueueFile(file) {
  uploadQueue.push({ type: 'file', name: file.name, file });
  renderQueue();
}

function enqueueUrl(url) {
  uploadQueue.push({ type: 'url', url });
  renderQueue();
}

/* ---------- file picker: reliable open + reset ---------- */
function openFilePicker() {
  if (!fileInput) return;
  // Reset so choosing the same file again still fires 'change'
  fileInput.value = '';
  fileInput.click();
}

on(fileInput, 'change', () => {
  if (!fileInput.files || !fileInput.files.length) return;
  [...fileInput.files].forEach(enqueueFile);
  // reset again to allow re-choosing same file later
  fileInput.value = '';
});

/* Bind any element with [data-browse], plus our explicit button */
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-browse]')) openFilePicker();
});
on(browseBtn, 'click', openFilePicker);

/* ---------- dropzone: click + keyboard + drag&drop ---------- */
if (dropzone) {
  // Clicking dropzone opens picker
  on(dropzone, 'click', openFilePicker);

  // Keyboard accessibility (Enter/Space)
  on(dropzone, 'keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openFilePicker();
    }
  });

  // Prevent default browser behavior on document to allow drops anywhere over DZ
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
    on(document, evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  // Visual feedback when dragging over the dropzone
  ['dragenter', 'dragover'].forEach(evt => {
    on(dropzone, evt, () => dropzone.classList.add('is-dragover'));
  });
  ['dragleave', 'drop'].forEach(evt => {
    on(dropzone, evt, () => dropzone.classList.remove('is-dragover'));
  });

  // Handle actual drop (files + links/text)
  on(dropzone, 'drop', async (e) => {
    const dt = e.dataTransfer;

    // Files
    if (dt?.files && dt.files.length) {
      [...dt.files].forEach(enqueueFile);
    }

    // URLs / text (uri-list preferred; fallback to plain)
    if (dt?.items) {
      for (const item of dt.items) {
        if (item.kind === 'string' && (item.type === 'text/uri-list' || item.type === 'text/plain')) {
          const text = await new Promise(res => item.getAsString(res));
          const maybe = text?.trim();
          if (isProbablyUrl(maybe)) enqueueUrl(maybe);
        }
      }
    }
  });
}

/* ---------- paste box: Enter to enqueue URL ---------- */
if (pasteInput) {
  on(pasteInput, 'keydown', (e) => {
    if (e.key === 'Enter') {
      const val = pasteInput.value.trim();
      if (isProbablyUrl(val)) {
        enqueueUrl(val);
        pasteInput.value = '';
      } else if (val) {
        // Optional: gentle feedback for non-URL text
        // alert('Please paste a valid http(s) link.');
      }
    }
  });
}

/* ---------- convert button (stub) ---------- */
on(convertBtn, 'click', () => {
  if (!uploadQueue.length) {
    alert('Add files or links first.');
    return;
  }
  const fmt = (formatSelect?.value || 'mp4').toLowerCase();
  // TODO: Replace with your backend call (e.g., /api/convert)
  console.log('[DRIPL] Submitting queue:', uploadQueue, 'format:', fmt);
  alert(`(demo) Submitting ${uploadQueue.length} item(s) as ${fmt.toUpperCase()}. Check console.`);
});

/* ---------- optional: expose queue for debugging ---------- */
window.__dripl = Object.assign(window.__dripl || {}, {
  getQueue: () => uploadQueue.slice(),
  clearQueue: () => { uploadQueue.length = 0; renderQueue(); },
});





























