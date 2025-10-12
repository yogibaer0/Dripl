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































