/* --- Tabs controller (Upload, Import, Storage) --- */
(function tabs(){
  const tabs = Array.from(document.querySelectorAll('.tab[data-tab]'));
  if (!tabs.length) return;

  function setOpen(name, pushHash = true){
    tabs.forEach(sec => {
      const on = sec.dataset.tab === name;
      sec.setAttribute('aria-expanded', String(on));
    });
    if (pushHash) history.replaceState(null, '', name ? `#${name}` : ' ');
  }

  // attach button clicks
  tabs.forEach(sec => {
    const btn = sec.querySelector('.tab__button');
    if (!btn) return;
    btn.addEventListener('click', () => setOpen(sec.dataset.tab));
  });

  // open from hash or default none-open
  const fromHash = (location.hash || '').replace('#','').trim();
  if (fromHash && tabs.some(t => t.dataset.tab === fromHash)){
    setOpen(fromHash, false);
  } else {
    // start with all closed to keep equal size
    setOpen('', false);
  }

  // allow manual hash changing
  window.addEventListener('hashchange', ()=>{
    const h = (location.hash || '').replace('#','').trim();
    setOpen(h || '', false);
  });
})();
/* ============================
   IMPORT: Local, Dropbox, GDrive
   ============================ */
(function setupImport(){
  const log = (msg) => {
    const ul = document.getElementById('importLog');
    if (!ul) return;
    const li = document.createElement('li');
    li.textContent = msg;
    ul.prepend(li);
  };

  // 1) This device (files + folder)
  const localBtn = document.getElementById('importLocalBtn');
  const localInput = document.getElementById('importLocalInput');
  const folderBtn = document.getElementById('importFolderBtn');

  localBtn?.addEventListener('click', () => localInput?.click());
  localInput?.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    handleImportedFiles(files);
  });

  // Optional: File System Access API (Chrome/Edge)
  folderBtn?.addEventListener('click', async () => {
    if (!window.showDirectoryPicker) {
      alert('Folder picker not supported in this browser.');
      return;
    }
    try {
      const dirHandle = await window.showDirectoryPicker();
      const files = [];
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          const f = await entry.getFile();
          files.push(f);
        }
      }
      if (files.length) handleImportedFiles(files);
    } catch (err) {
      if (err?.name !== 'AbortError') console.error(err);
    }
  });

  // 2) Dropbox (Chooser)
  const dropboxBtn = document.getElementById('dropboxBtn');
  dropboxBtn?.addEventListener('click', () => {
    if (!window.Dropbox) {
      alert('Dropbox SDK not loaded.');
      return;
    }
    Dropbox.choose({
      linkType: 'direct',          // direct URL for download
      multiselect: true,
      extensions: ['.mp4', '.mp3', '.mov', '.m4a', '.wav', '.aac', '.mkv'],
      success: (files) => {
        // files: [{link, name, bytes, ...}]
        // You can fetch these links server-side or client-side (CORS permitting)
        log(`Dropbox: selected ${files.length} file(s)`);
        // Example: turn into "virtual" File-like objects with only URL/name
        const virtuals = files.map(f => ({ name: f.name, size: f.bytes, _remoteUrl: f.link }));
        handleImportedFiles(virtuals);
      },
      cancel: () => log('Dropbox: chooser closed'),
    });
  });

  // 3) Google Drive (Picker)
  const gdriveBtn = document.getElementById('gdriveBtn');
  const CONFIG = {
    gapiKey: 'YOUR_GOOGLE_API_KEY',               // TODO: replace
    clientId: 'YOUR_GOOGLE_OAUTH_CLIENT_ID',      // TODO: replace
    scope: 'https://www.googleapis.com/auth/drive.readonly'
  };

  let googleToken = null;

  function onGisToken(response){
    googleToken = response.access_token;
    openGDrivePicker();
  }

  function openGDrivePicker(){
    if (!googleToken || !window.google || !window.gapi) {
      alert('Google libraries not ready.');
      return;
    }
    gapi.load('picker', () => {
      const view = new google.picker.DocsView(google.picker.ViewId.DOCS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false);
      const picker = new google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(googleToken)
        .setDeveloperKey(CONFIG.gapiKey)
        .setCallback(googlePickerCallback)
        .setTitle('Choose from Google Drive')
        .build();
      picker.setVisible(true);
    });
  }

  function googlePickerCallback(data){
    if (data.action !== google.picker.Action.PICKED) return;
    const docs = data.docs || [];
    log(`Google Drive: selected ${docs.length} item(s)`);
    // Each doc has id/name/url; to download, call Drive API (needs server or CORS-enabled file export).
    // For now we just log names and pass lightweight objects:
    const virtuals = docs.map(d => ({ name: d.name, id: d.id, _gdrive: true }));
    handleImportedFiles(virtuals);
  }

  gdriveBtn?.addEventListener('click', async () => {
    if (!window.google || !window.google.accounts || !window.gapi) {
      alert('Google APIs not loaded yet. Try again in a second.');
      return;
    }
    try {
      // Initialize token client for OAuth
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.clientId,
        scope: CONFIG.scope,
        callback: onGisToken,
      });
      // Kick off OAuth popup
      tokenClient.requestAccessToken({ prompt: 'consent' });
      // Load gapi client for picker
      await new Promise(res => gapi.load('client', res));
    } catch (err) {
      console.error(err);
      alert('Google auth failed. Check console.');
    }
  });

  // Your app’s canonical handler for imported items
  function handleImportedFiles(files){
    // files = array of File objects or "virtual" {name, _remoteUrl} objects
    log(`Imported ${files.length} item(s)`);
    // TODO: enqueue into your pipeline, or show a confirmation list
    console.log('Imported items:', files);
  }
})();


/* --- Simple stubs so existing IDs continue to work --- */
document.getElementById('convertBtn')?.addEventListener('click', () => {
  const url = document.getElementById('convertUrl')?.value?.trim();
  const fmt = document.getElementById('convertFormat')?.value || 'mp4';
  if (!url) return;
  console.log('Convert requested:', { url, fmt });
  // hook your existing conversion fetch here
});

document.getElementById('convertUrl')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('convertBtn')?.click();
});

document.getElementById('browseBtn')?.addEventListener('click', () => {
  // wire to your hidden <input type="file"> if you have one
  alert('Browse files (stub)');
});

document.getElementById('importStub')?.addEventListener('click', () => alert('Connect (stub)'));
document.getElementById('storageStub')?.addEventListener('click', () => alert('Configure (stub)'));


















