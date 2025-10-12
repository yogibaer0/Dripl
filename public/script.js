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

  function handleFiles(fileList){
    const files = Array.from(fileList);
    // For now just log the files; wire into your pipeline/queue here.
    console.log('Dropped files:', files.map(f => `${f.name} (${f.type||'type/unknown'})`));
  }
})();

// === Paste-link Convert wired to /api/download ===
const pasteInput   = document.getElementById('pasteInput');
const formatSelect = document.getElementById('formatSelect');
const convertBtn   = document.getElementById('convertBtn');

async function convertNow() {
  const url = (pasteInput?.value || '').trim();
  const fmt = (formatSelect?.value || 'mp4').toLowerCase();
  if (!url) { alert('Paste a link first 🙂'); return; }

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































