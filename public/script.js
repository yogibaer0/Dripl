/***********************
 * ENV from /env.js
 ***********************/
const ENV = window.__ENV__ || {};
const DROPBOX_KEY = ENV.DROPBOX_APP_KEY || '';
const GOOGLE_API_KEY = ENV.GOOGLE_API_KEY || '';
const GOOGLE_OAUTH_CLIENT_ID = ENV.GOOGLE_OAUTH_CLIENT_ID || '';

/***********************
 * Tabs (open one-at-a-time)
 ***********************/
(function tabs(){
  const tabs = [...document.querySelectorAll('.tab')];
  const buttons = [...document.querySelectorAll('.tab__button')];

  const open = (el) => {
    tabs.forEach(t => t.setAttribute('aria-expanded', t === el ? 'true' : 'false'));
  };

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.closest('.tab');
      const isOpen = section.getAttribute('aria-expanded') === 'true';
      open(isOpen ? null : section);
    });
  });

  // make Upload default open
  const uploadTab = document.querySelector('.tab[data-tab="upload"]');
  if (uploadTab) uploadTab.setAttribute('aria-expanded','true');
})();

/***********************
 * Glow dot follows path (unchanged)
 ***********************/
(function glowPath(){
  const wrap = document.querySelector('.glow-line');
  const svg  = wrap?.querySelector('svg');
  const path = svg?.querySelector('#driplGlowPath');
  const dot  = document.getElementById('glowDot');
  if (!wrap || !svg || !path || !dot) return;

  let len = 0, t = 0, dir = 1;
  function measure(){ len = path.getTotalLength(); }

  function tick(){
    t += dir * 0.006;
    if (t >= 1) { t = 1; dir = -1; }
    if (t <= 0) { t = 0; dir =  1; }

    const p = path.getPointAtLength(len * t);
    const box = svg.getBoundingClientRect();
    const x = box.left + (p.x/100) * box.width;
    const y = box.top  + (p.y/24)  * box.height;
    dot.style.left = `${x}px`;
    dot.style.top  = `${y}px`;

    requestAnimationFrame(tick);
  }

  const ro = new ResizeObserver(measure);
  ro.observe(svg);
  measure(); tick();
})();

/***********************
 * Upload: basics (drop & browse & paste-enter)
 ***********************/
(function upload(){
  const dropZone = document.getElementById('dropZone');
  const input = document.getElementById('uploadInput');
  const browseBtn = document.getElementById('browseBtn');
  const urlInput = document.getElementById('urlInput');
  const formatSelect = document.getElementById('formatSelect');
  const convertBtn = document.getElementById('convertBtn');

  browseBtn?.addEventListener('click', ()=> input?.click());
  input?.addEventListener('change', (e)=>{
    const files = [...(e.target.files||[])];
    if (files.length) console.log('UPLOAD files:', files);
  });

  const stop = e => { e.preventDefault(); e.stopPropagation(); };
  ['dragenter','dragover','dragleave','drop'].forEach(evt => {
    dropZone?.addEventListener(evt, stop, false);
  });
  dropZone?.addEventListener('drop', e=>{
    const files = [...(e.dataTransfer?.files||[])];
    if (files.length) console.log('DROP files:', files);
  });

  function doConvert(){
    const url = urlInput?.value?.trim();
    const format = (formatSelect?.value||'').toLowerCase();
    if (!url) return;
    console.log('CONVERT request:', { url, format });
    // TODO: call your server endpoint
  }
  urlInput?.addEventListener('keydown', e=>{
    if (e.key === 'Enter') doConvert();
  });
  convertBtn?.addEventListener('click', doConvert);
})();

/***********************
 * Import: local, Dropbox, Google Drive
 ***********************/
(function setupImport(){
  const log = (msg) => {
    const ul = document.getElementById('importLog');
    if (!ul) return;
    const li = document.createElement('li');
    li.textContent = msg;
    ul.prepend(li);
  };

  // 1) Local device
  const localBtn = document.getElementById('importLocalBtn');
  const localInput = document.getElementById('importLocalInput');
  const folderBtn = document.getElementById('importFolderBtn');

  localBtn?.addEventListener('click', () => localInput?.click());
  localInput?.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    handleImported(files);
  });

  folderBtn?.addEventListener('click', async () => {
    if (!window.showDirectoryPicker) { alert('Folder picker not supported.'); return; }
    try {
      const dir = await window.showDirectoryPicker();
      const files = [];
      for await (const entry of dir.values()){
        if (entry.kind === 'file') files.push(await entry.getFile());
      }
      if (files.length) handleImported(files);
    } catch(e){ if (e?.name!=='AbortError') console.error(e); }
  });

  // 2) Dropbox Chooser (load SDK dynamically with env key)
  (function loadDropboxSDK(){
    if (!DROPBOX_KEY || document.getElementById('dropboxjs')) return;
    const s = document.createElement('script');
    s.id = 'dropboxjs';
    s.src = 'https://www.dropbox.com/static/api/2/dropins.js';
    s.dataset.appKey = DROPBOX_KEY;
    document.head.appendChild(s);
  })();

  const dropboxBtn = document.getElementById('dropboxBtn');
  dropboxBtn?.addEventListener('click', () => {
    if (!window.Dropbox) { alert('Dropbox SDK not loaded yet.'); return; }
    Dropbox.choose({
      linkType:'direct', multiselect:true,
      extensions:['.mp4','.mp3','.mov','.m4a','.wav','.aac','.mkv'],
      success: files => {
        log(`Dropbox: ${files.length} selected`);
        const virtuals = files.map(f => ({ name:f.name, size:f.bytes, _remoteUrl:f.link }));
        handleImported(virtuals);
      },
      cancel: ()=> log('Dropbox chooser closed')
    });
  });

  // 3) Google Drive Picker
  const gdriveBtn = document.getElementById('gdriveBtn');
  let googleToken = null;

  function onGisToken(resp){
    googleToken = resp.access_token;
    openPicker();
  }

  function openPicker(){
    if (!googleToken || !window.google || !window.gapi) { alert('Google libraries not ready'); return; }
    gapi.load('picker', () => {
      const view = new google.picker.DocsView(google.picker.ViewId.DOCS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false);
      const picker = new google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(googleToken)
        .setDeveloperKey(GOOGLE_API_KEY)
        .setTitle('Choose from Google Drive')
        .setCallback(data=>{
          if (data.action !== google.picker.Action.PICKED) return;
          const docs = data.docs || [];
          log(`Google Drive: ${docs.length} selected`);
          const virtuals = docs.map(d => ({ name:d.name, id:d.id, _gdrive:true }));
          handleImported(virtuals);
        })
        .build();
      picker.setVisible(true);
    });
  }

  gdriveBtn?.addEventListener('click', async () => {
    if (!window.google?.accounts?.oauth2 || !window.gapi) {
      alert('Google APIs loading… try again in a second.');
      return;
    }
    try{
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_OAUTH_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
        callback: onGisToken,
      });
      tokenClient.requestAccessToken({ prompt: 'consent' });
      await new Promise(res => gapi.load('client', res));
    }catch(e){ console.error(e); alert('Google auth failed.'); }
  });

  function handleImported(items){
    console.log('Imported items:', items);
    log(`Imported ${items.length} item(s)`);
    // TODO: push to your pipeline queue
  }
})();



















