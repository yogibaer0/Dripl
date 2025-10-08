document.addEventListener('DOMContentLoaded', () => {
  const tabs = Array.from(document.querySelectorAll('.tab'));

  // Start CLOSED
  tabs.forEach(t => t.setAttribute('aria-expanded','false'));

  function openOnly(targetTab){
    tabs.forEach(tab => {
      const open = (tab === targetTab) && (tab.getAttribute('aria-expanded') !== 'true');
      // close all
      tab.setAttribute('aria-expanded', 'false');
      tab.classList.remove('expanded');
      // then open target
      if (open){
        tab.setAttribute('aria-expanded', 'true');
        tab.classList.add('expanded');
      }
    });
  }

  tabs.forEach(tab => {
    const btn = tab.querySelector('.tab__button');
    btn.addEventListener('click', () => {
      const isOpen = tab.getAttribute('aria-expanded') === 'true';
      if (isOpen){
        // close back to normal
        tab.setAttribute('aria-expanded','false');
        tab.classList.remove('expanded');
      }else{
        // open only this one (accordion)
        openOnly(tab);
      }
    });

    // keyboard
    btn.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }
    });
  });

  /* --- Existing upload stubs --- */
  const paste   = document.getElementById('pasteLink');
  const format  = document.getElementById('formatSelect');
  const convert = document.getElementById('convertBtn');

  function startConvert(){
    const url = (paste?.value || '').trim();
    if (!url) return;
    window.dispatchEvent(new CustomEvent('dripl:convert', {
      detail: { url, format: format?.value || 'MP4 (video)' }
    }));
  }
  paste?.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); startConvert(); }});
  convert?.addEventListener('click', startConvert);

  /* --- Import stubs --- */
  const pickFiles  = document.getElementById('pickFiles');
  const pickFolder = document.getElementById('pickFolder');
  const importLog  = document.getElementById('importLog');

  function log(msg){
    if (!importLog) return;
    const li = document.createElement('li');
    li.textContent = msg;
    importLog.appendChild(li);
  }
  function handleFiles(files){
    const arr = Array.from(files);
    log(`Selected ${arr.length} file(s).`);
    window.dispatchEvent(new CustomEvent('dripl:files',{detail:{files:arr}}));
  }

  if (pickFiles){
    const input = document.createElement('input');
    input.type = 'file'; input.multiple = true; input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', () => handleFiles(input.files));
    pickFiles.addEventListener('click', () => input.click());
  }

  if (pickFolder && 'showDirectoryPicker' in window){
    pickFolder.addEventListener('click', async () => {
      try{
        const dir = await window.showDirectoryPicker();
        const files = [];
        for await (const entry of dir.values()){
          if (entry.kind === 'file') files.push(await entry.getFile());
        }
        handleFiles(files);
      }catch(_){}
    });
  }else if (pickFolder){
    pickFolder.disabled = true;
    pickFolder.title = 'Directory picker not supported in this browser';
  }

  document.getElementById('connectDropbox')?.addEventListener('click', () => log('Dropbox connect clicked.'));
  document.getElementById('connectDrive')?.addEventListener('click',   () => log('Google Drive connect clicked.'));
});























