// ========= helpers =========
const $ = (sel, root = document) => root.querySelector(sel);
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

// ========= upload: native pickers & DnD =========
const dropzone = $('#dropzone');
const fileInput = $('#fileInput');
const dirInput  = $('#dirInput');
const chooseFilesBtn  = $('#chooseFilesBtn');
const chooseFolderBtn = $('#chooseFolderBtn');

on(chooseFilesBtn, 'click', () => fileInput.click());
on(chooseFolderBtn, 'click', () => dirInput.click());
on($('#importChooseFiles'),  'click', () => fileInput.click());
on($('#importChooseFolder'), 'click', () => dirInput.click());

on(fileInput, 'change', () => handleFiles(fileInput.files, 'files'));
on(dirInput,  'change', () => handleFiles(dirInput.files, 'folder'));

function handleFiles(fileList, source){
  if (!fileList || !fileList.length) return;
  console.log(`[${source}] selected`, Array.from(fileList).map(f => f.name));
  // TODO: push into your app state / preview queue
}

// Basic DnD
['dragenter','dragover'].forEach(evt => on(dropzone, evt, e => {e.preventDefault(); dropzone.style.opacity = .8;}));
['dragleave','drop'].forEach(evt => on(dropzone, evt, e => {e.preventDefault(); dropzone.style.opacity = 1;}));
on(dropzone, 'drop', e => {
  const files = e.dataTransfer?.files;
  if (files?.length) handleFiles(files, 'drag-drop');
});

// ========= format + convert =========
const formatSelect = $('#formatSelect');
const pasteLink = $('#pasteLink');
const convertBtn = $('#convertBtn');

on(convertBtn, 'click', convertNow);
on(pasteLink, 'keydown', e => { if (e.key === 'Enter') convertNow(); });

function convertNow(){
  const fmt = formatSelect.value;
  const url = pasteLink.value.trim();
  console.log('Convert requested', { fmt, url });
  // TODO: call your backend /api/convert with { url, fmt }
  alert(`(demo) Would convert ${url || '[local files]'} ➜ ${fmt.toUpperCase()}`);
}

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




























