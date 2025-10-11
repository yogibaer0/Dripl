/* ========= Accordion: one-open-at-a-time ========= */
const tabs = Array.from(document.querySelectorAll('.tab'));
const btns = tabs.map(t => t.querySelector('.tab__button'));
function setOpen(tab, on){ tab.setAttribute('aria-expanded', String(on)); tab.classList.toggle('open', on); }
function closeAll(){ tabs.forEach(t => setOpen(t,false)); document.querySelector('.panels')?.classList.remove('expanded'); }
function openOnly(tab){ tabs.forEach(t => setOpen(t, t===tab)); document.querySelector('.panels')?.classList.add('expanded'); }
btns.forEach(b => b.addEventListener('click', () => {
  const tab = b.closest('.tab');
  const isOpen = tab.getAttribute('aria-expanded') === 'true';
  isOpen ? closeAll() : (openOnly(tab), tab.scrollIntoView({behavior:'smooth', block:'start'}));
}));
window.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });
closeAll(); // start collapsed

/* ========= Small util helpers ========= */
const setStatus = (msg) => { const el = document.getElementById('importStatus'); if (el) el.textContent = msg || ""; };
function loadScript(src, attrs = {}) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

/* ========= Local pickers ========= */
const pickFiles   = document.getElementById('pickFiles');
const pickFolder  = document.getElementById('pickFolder');

document.getElementById('pickFilesBtn')?.addEventListener('click', () => pickFiles?.click());
pickFiles?.addEventListener('change', () => {
  if (pickFiles.files?.length) {
    setStatus(`Selected ${pickFiles.files.length} file(s)`);
    // TODO: hand off to your pipeline
  }
});

document.getElementById('pickFolderBtn')?.addEventListener('click', () => pickFolder?.click());
pickFolder?.addEventListener('change', () => {
  if (pickFolder.files?.length) {
    setStatus(`Selected folder with ${pickFolder.files.length} item(s)`);
    // TODO: hand off to your pipeline
  }
});

/* ========= Dropbox Chooser ========= */
async function chooseFromDropbox() {
  const key = window.ENV?.DROPBOX_APP_KEY;
  if (!key) { alert('Missing DROPBOX_APP_KEY'); return null; }
  await loadScript('https://www.dropbox.com/static/api/2/dropins.js', { id:'dropboxjs', 'data-app-key': key });
  return new Promise((resolve) => {
    window.Dropbox.choose({
      multiselect: true,
      linkType: 'direct',
      success: files => resolve(files),
      cancel: () => resolve(null),
    });
  });
}
document.getElementById('connectDropbox')?.addEventListener('click', async () => {
  setStatus('Opening Dropbox Chooser…');
  try {
    const files = await chooseFromDropbox();
    if (!files) return setStatus('Dropbox: cancelled');
    setStatus(`Dropbox: selected ${files.length} item(s)`);
    // TODO: hand off list of {link,name,bytes,...}
  } catch (e) {
    console.error(e);
    setStatus('Dropbox: error');
  }
});

/* ========= Google Drive Picker ========= */
let gPickerReady = false;
async function initGPicker(){
  if (gPickerReady) return;
  const API_KEY  = window.ENV?.GOOGLE_API_KEY;
  const CLIENT_ID= window.ENV?.GOOGLE_CLIENT_ID;
  if (!API_KEY || !CLIENT_ID){ alert('Missing GOOGLE_API_KEY / GOOGLE_CLIENT_ID'); return; }
  await loadScript('https://apis.google.com/js/api.js');
  await loadScript('https://accounts.google.com/gsi/client');
  await new Promise(res => gapi.load('client:picker', res));
  await gapi.client.init({ apiKey: API_KEY, discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'] });
  gPickerReady = true;
}
async function openDrivePicker(){
  const API_KEY  = window.ENV?.GOOGLE_API_KEY;
  const CLIENT_ID= window.ENV?.GOOGLE_CLIENT_ID;
  await initGPicker();
  if (!gPickerReady) return null;

  const token = await new Promise((resolve, reject) => {
    google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      callback: (resp) => resp && resp.access_token ? resolve(resp.access_token) : reject(new Error('No token')),
    }).requestAccessToken();
  });

  return new Promise((resolve) => {
    const view = new google.picker.DocsView(google.picker.ViewId.DOCS)
      .setIncludeFolders(true).setSelectFolderEnabled(true);
    const picker = new google.picker.PickerBuilder()
      .setDeveloperKey(API_KEY).setAppId(CLIENT_ID).setOAuthToken(token)
      .addView(view).setMaxItems(50)
      .setCallback(data => {
        if (data.action === google.picker.Action.PICKED) resolve(data.docs || []);
        else if (data.action === google.picker.Action.CANCEL) resolve(null);
      }).build();
    picker.setVisible(true);
  });
}
document.getElementById('connectGDrive')?.addEventListener('click', async () => {
  setStatus('Opening Google Drive Picker…');
  try {
    const docs = await openDrivePicker();
    if (!docs) return setStatus('Drive: cancelled');
    setStatus(`Drive: selected ${docs.length} item(s)`);
    // TODO: hand off list of {id,name,mimeType,sizeBytes,url,...}
  } catch (e) {
    console.error(e);
    setStatus('Drive: error');
  }
});



























