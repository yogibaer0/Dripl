document.addEventListener('DOMContentLoaded', () => {
  // Collapsible modules with persistent open state
  const SINGLE_OPEN = false;             // set true for classic accordion
  const STORE_KEY   = 'dripl.tabs.open';
  const tabs        = Array.from(document.querySelectorAll('.tab'));

  // Start with NO tabs open by default (empty set), unless sessionStorage has a value
  let openSet = new Set(
    JSON.parse(sessionStorage.getItem(STORE_KEY) || '[]')
  );

  function applyOpenState(){
    tabs.forEach(tab => {
      const id = tab.dataset.tab;
      const open = openSet.has(id);
      tab.setAttribute('aria-expanded', open ? 'true' : 'false');
      tab.classList.toggle('is-open', open);
    });
  }

  tabs.forEach(tab => {
    const id  = tab.dataset.tab;
    const btn = tab.querySelector('.tab__button');

    btn.addEventListener('click', () => {
      const isOpen = openSet.has(id);
      if (SINGLE_OPEN) {
        openSet = new Set(isOpen ? [] : [id]);
      } else {
        if (isOpen) openSet.delete(id);
        else openSet.add(id);
      }
      sessionStorage.setItem(STORE_KEY, JSON.stringify([...openSet]));
      applyOpenState();
    });

    // Accessible toggle via keyboard
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        btn.click();
      }
    });
  });

  applyOpenState();

  // --- Upload actions (stubs) ---
  const paste   = document.getElementById('pasteLink');
  const format  = document.getElementById('formatSelect');
  const convert = document.getElementById('convertBtn');

  function startConvert() {
    const url = (paste?.value || '').trim();
    if (!url) return;
    window.dispatchEvent(new CustomEvent('dripl:convert', {
      detail: { url, format: format?.value || 'MP4 (video)' }
    }));
  }
  paste?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); startConvert(); }});
  convert?.addEventListener('click', startConvert);

  // --- Import local (stubs) ---
  const pickFiles  = document.getElementById('pickFiles');
  const pickFolder = document.getElementById('pickFolder');
  const importLog  = document.getElementById('importLog');

  function log(msg){
    if (!importLog) return;
    const li = document.createElement('li');
    li.textContent = msg;
    importLog.appendChild(li);
  }

  function handleFiles(files) {
    const arr = Array.from(files);
    log(`Selected ${arr.length} file(s).`);
    window.dispatchEvent(new CustomEvent('dripl:files', { detail: { files: arr }}));
  }

  if (pickFiles) {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', () => handleFiles(input.files));
    pickFiles.addEventListener('click', () => input.click());
  }

  if (pickFolder && 'showDirectoryPicker' in window) {
    pickFolder.addEventListener('click', async () => {
      try {
        const dir = await window.showDirectoryPicker();
        const files = [];
        for await (const entry of dir.values()) {
          if (entry.kind === 'file') files.push(await entry.getFile());
        }
        handleFiles(files);
      } catch (_) { /* canceled */ }
    });
  } else if (pickFolder) {
    pickFolder.disabled = true;
    pickFolder.title = 'Directory picker not supported in this browser';
  }

  // --- Cloud provider stubs (hook later) ---
  document.getElementById('connectDropbox')?.addEventListener('click', () => {
    log('Dropbox connect clicked (wire SDK later).');
  });
  document.getElementById('connectDrive')?.addEventListener('click', () => {
    log('Google Drive connect clicked (wire Picker later).');
  });
});





















