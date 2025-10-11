// ========= helpers =========
const $ = (sel, root = document) => root.querySelector(sel);
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

// ===== Upload: Drag & Drop + Files + URLs =====
const dropzone     = document.getElementById('dropzone');
const fileInput    = document.getElementById('fileInput');
const browseBtn    = document.getElementById('browseBtn');
const queueEl      = document.getElementById('uploadQueue');
const pasteInput   = document.getElementById('pasteInput');
const formatSelect = document.getElementById('formatSelect');
const convertBtn   = document.getElementById('convertBtn');

const uploadQueue = []; // { type: 'file'|'url', name?:string, file?:File, url?:string }

function isProbablyUrl(text){
  try {
    const u = new URL(text);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
}

function renderQueue(){
  queueEl.innerHTML = '';
  uploadQueue.forEach((item, i) => {
    const li = document.createElement('li');
    const kind = document.createElement('span');
    kind.className = 'badge';
    kind.textContent = item.type.toUpperCase();

    const label = document.createElement('span');
    label.textContent = item.type === 'file' ? item.name : item.url;

    const rm = document.createElement('button');
    rm.className = 'btn'; rm.style.marginLeft = 'auto';
    rm.textContent = 'Remove';
    rm.onclick = () => { uploadQueue.splice(i,1); renderQueue(); };

    li.append(kind, label, rm);
    queueEl.appendChild(li);
  });
}

function enqueueFile(file){
  uploadQueue.push({ type:'file', name:file.name, file });
  renderQueue();
}
function enqueueUrl(url){
  uploadQueue.push({ type:'url', url });
  renderQueue();
}

// --- Drag events
['dragenter','dragover'].forEach(evt => {
  dropzone.addEventListener(evt, e => {
    e.preventDefault(); e.stopPropagation();
    dropzone.classList.add('is-dragover');
  });
});
['dragleave','drop'].forEach(evt => {
  dropzone.addEventListener(evt, e => {
    e.preventDefault(); e.stopPropagation();
    dropzone.classList.remove('is-dragover');
  });
});

dropzone.addEventListener('drop', async (e) => {
  const dt = e.dataTransfer;

  // Files
  if (dt.files && dt.files.length){
    [...dt.files].forEach(enqueueFile);
  }

  // URLs / text
  if (dt.items){
    for (const item of dt.items){
      if (item.kind === 'string'){
        // Prefer uri-list for links
        if (item.type === 'text/uri-list' || item.type === 'text/plain'){
          const text = await new Promise(res => item.getAsString(res));
          if (text && isProbablyUrl(text.trim())) enqueueUrl(text.trim());
        }
      }
    }
  }
});

// Optional “Browse files” still available
browseBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  [...fileInput.files].forEach(enqueueFile);
  fileInput.value = ''; // reset
});

// Paste link input -> enqueue on Enter
pasteInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter'){
    const val = pasteInput.value.trim();
    if (isProbablyUrl(val)){
      enqueueUrl(val);
      pasteInput.value = '';
    }
  }
});

// Convert button (stub – wire to your backend flow)
convertBtn.addEventListener('click', async () => {
  if (!uploadQueue.length) return alert('Add files or links first.');
  const fmt = formatSelect.value; // 'mp4' or 'mp3'

  // TODO: send to your API; below is just a visualization
  console.log('Submitting queue:', uploadQueue, 'format:', fmt);
  alert(`Submitting ${uploadQueue.length} item(s) as ${fmt.toUpperCase()}`);
});


// ========= Dropbox & Google Drive (guarded stubs) =========
on($('#connectDropbox'), 'click', async () => {
  const key = window.ENV?.DROPBOX_APP_KEY;
  if (!key || key.includes('YOUR_DROPBOX_APP_KEY')){
    alert('Set DROPBOX_APP_KEY in env.js (and Render env vars) to enable Dropbox.');
    return;
  }
  // Lazy-load Dropbox Chooser
  await loadScript('https://www.dropbox.com/static/api/2/dropins.js', { id: 'dropboxjs', 'data-app-key': key });
  if (!window.Dropbox){ alert('Dropbox SDK failed to load.'); return; }
  window.Dropbox.choose({
    linkType: 'direct', multiselect: true, extensions: ['.mp4','.mov','.mp3','.wav','.m4a','.mkv'],
    success: files => {
      console.log('Dropbox selected:', files);
      alert(`(demo) Dropbox picked ${files.length} item(s). See console.`);
    }
  });
});

on($('#connectDrive'), 'click', async () => {
  const apiKey = window.ENV?.GOOGLE_API_KEY;
  const clientId = window.ENV?.GOOGLE_CLIENT_ID;
  if (!apiKey || apiKey.includes('YOUR_GOOGLE_API_KEY') || !clientId || clientId.includes('YOUR_GOOGLE_OAUTH_CLIENT_ID')){
    alert('Set GOOGLE_API_KEY and GOOGLE_CLIENT_ID in env.js (and Render env vars) to enable Google Drive.');
    return;
  }

  // Load Google APIs platform script on demand
  await loadScript('https://apis.google.com/js/api.js');
  await new Promise(res => gapi.load('client:picker:auth2', res));

  await gapi.client.init({ apiKey, clientId, scope: 'https://www.googleapis.com/auth/drive.readonly' });
  const auth = gapi.auth2.getAuthInstance();
  if (!auth.isSignedIn.get()) await auth.signIn();

  const oauthToken = gapi.auth.getToken().access_token;
  await loadScript('https://apis.google.com/js/api.js?onload=__noop'); // ensure picker module
  const view = new google.picker.DocsView(google.picker.ViewId.DOCS).setIncludeFolders(true).setSelectFolderEnabled(true);
  const picker = new google.picker.PickerBuilder()
    .setOAuthToken(oauthToken)
    .setDeveloperKey(apiKey)
    .addView(view)
    .setCallback(data => {
      if (data.action === google.picker.Action.PICKED){
        console.log('Drive picked:', data.docs);
        alert(`(demo) Google Drive picked ${data.docs.length} item(s). See console.`);
      }
    }).build();
  picker.setVisible(true);
});

// ========= utils =========
function loadScript(src, attrs = {}){
  return new Promise((resolve, reject) => {
    if (attrs.id && document.getElementById(attrs.id)) return resolve();
    const s = document.createElement('script');
    s.src = src; Object.entries(attrs).forEach(([k,v]) => s.setAttribute(k, v));
    s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
  });
}
window.__noop = () => {};




























