// Accordion: one-open-at-a-time, expanded tab spans full row

const tabs = Array.from(document.querySelectorAll('.tab'));
const buttons = tabs.map(t => t.querySelector('.tab__button'));
const grid = document.querySelector('.tabs-grid');

function setExpanded(tab, on) {
  tab.setAttribute('aria-expanded', String(on));
  tab.classList.toggle('expanded', on);
}

function closeAll() {
  tabs.forEach(t => setExpanded(t, false));
  grid?.classList.remove('has-open');
  document.documentElement.style.setProperty('--hub-shift', '0px');
}

function openOnly(tab) {
  tabs.forEach(t => setExpanded(t, t === tab));
  grid?.classList.add('has-open');
  document.documentElement.style.setProperty('--hub-shift', '28px');
}

buttons.forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.closest('.tab');
    const isOpen = tab.getAttribute('aria-expanded') === 'true';
    isOpen ? closeAll() : (openOnly(tab), tab.scrollIntoView({behavior:'smooth', block:'start'}));
  });
});

// ESC closes
window.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });

// start closed
closeAll();

/* ========== util: dynamic script loader ========== */
function loadScript(src, attrs = {}) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}
const setStatus = (msg) => { const el = document.getElementById('importStatus'); if (el) el.textContent = msg || ""; };

/* ========== Local: folder picking (webkitdirectory) ========== */
const pickFolder = document.getElementById('pickFolder');
document.getElementById('pickFolderBtn')?.addEventListener('click', () => pickFolder?.click());
pickFolder?.addEventListener('change', () => {
  if (pickFolder.files?.length) {
    setStatus(`Selected folder with ${pickFolder.files.length} files`);
    Store.set({ source: { type: 'import', provider: 'local-folder', files: pickFolder.files }});
  }
});

/* ========== Dropbox Chooser ========== */
async function chooseFromDropbox() {
  const key = window.ENV?.DROPBOX_APP_KEY;
  if (!key) { alert("Missing DROPBOX_APP_KEY"); return; }

  // Load SDK (adds window.Dropbox)
  await loadScript("https://www.dropbox.com/static/api/2/dropins.js", { id: "dropboxjs", "data-app-key": key });

  return new Promise((resolve) => {
    window.Dropbox.choose({
      linkType: "direct",   // we want direct links to pass to backend/downloader
      multiselect: true,
      success: (files) => resolve(files),
      cancel: () => resolve(null)
    });
  });
}

document.getElementById('connectDropbox')?.addEventListener('click', async () => {
  setStatus("Opening Dropbox Chooser…");
  try {
    const files = await chooseFromDropbox();
    if (!files) { setStatus("Dropbox: cancelled"); return; }
    setStatus(`Dropbox: selected ${files.length} item(s)`);
    // items contain {link, name, bytes, icon, thumbnailLink}
    Store.set({ source: { type: 'import', provider: 'dropbox', items: files }});
  } catch (e) {
    console.error(e);
    setStatus("Dropbox: error");
  }
});

/* ========== Google Drive Picker ========== */
let gPickerReady = false;
async function initGPicker() {
  if (gPickerReady) return;
  const API_KEY = window.ENV?.GOOGLE_API_KEY;
  const CLIENT_ID = window.ENV?.GOOGLE_CLIENT_ID;
  if (!API_KEY || !CLIENT_ID) { alert("Missing GOOGLE_API_KEY / GOOGLE_CLIENT_ID"); return; }

  // gapi + picker js
  await loadScript("https://apis.google.com/js/api.js");
  await loadScript("https://accounts.google.com/gsi/client"); // modern OAuth shim
  await new Promise(res => window.gapi.load('client:picker', res));
  await window.gapi.client.init({ apiKey: API_KEY, discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"] });
  gPickerReady = true;
}

async function openDrivePicker() {
  await initGPicker();
  const API_KEY = window.ENV?.GOOGLE_API_KEY;
  const CLIENT_ID = window.ENV?.GOOGLE_CLIENT_ID;

  // OAuth token via Google Identity Services
  const token = await new Promise((resolve, reject) => {
    google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      callback: (resp) => resp && resp.access_token ? resolve(resp.access_token) : reject(new Error("No token")),
    }).requestAccessToken();
  });

  return new Promise((resolve) => {
    const view = new google.picker.DocsView(google.picker.ViewId.DOCS)
      .setIncludeFolders(true).setSelectFolderEnabled(true);
    const picker = new google.picker.PickerBuilder()
      .setAppId(CLIENT_ID)
      .setOAuthToken(token)
      .setDeveloperKey(API_KEY)
      .addView(view)
      .setMaxItems(50)
      .setCallback((data) => {
        if (data.action === google.picker.Action.PICKED) {
          resolve(data.docs || []);
        } else if (data.action === google.picker.Action.CANCEL) {
          resolve(null);
        }
      }).build();
    picker.setVisible(true);
  });
}

document.getElementById('connectGDrive')?.addEventListener('click', async () => {
  setStatus("Opening Google Drive Picker…");
  try {
    const docs = await openDrivePicker();
    if (!docs) { setStatus("Drive: cancelled"); return; }
    setStatus(`Drive: selected ${docs.length} item(s)`);
    // docs contain {id, name, mimeType, sizeBytes, url, ...}
    Store.set({ source: { type: 'import', provider: 'gdrive', items: docs }});
  } catch (e) {
    console.error(e);
    setStatus("Drive: error");
  }
});


























