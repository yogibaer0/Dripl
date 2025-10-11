// ---------- Accordion: one panel open at a time ----------
const panels = document.querySelectorAll('.panel');
const toggles = document.querySelectorAll('[data-toggle]');

function openPanel(panelId) {
  panels.forEach(p => p.classList.remove('is-open'));
  const panel = document.getElementById(panelId);
  if (panel) panel.classList.add('is-open');
}

toggles.forEach(t => {
  t.addEventListener('click', () => {
    const id = t.getAttribute('data-toggle');
    // toggle if already open
    const target = document.getElementById(id);
    if (target.classList.contains('is-open')) {
      target.classList.remove('is-open');
    } else {
      openPanel(id);
    }
  });
});

// Default: keep all closed until user clicks
panels.forEach(p => p.classList.remove('is-open'));

// ---------- Local file/folder pickers ----------
const pickFiles  = document.getElementById('pickFiles');
const pickFolder = document.getElementById('pickFolder');

const btnChooseFiles  = document.getElementById('btnChooseFiles');
const btnChooseFolder = document.getElementById('btnChooseFolder');

// Ensure they exist on page (Import panel)
if (btnChooseFiles && pickFiles) {
  btnChooseFiles.addEventListener('click', () => {
    pickFiles.value = ''; // reset so selecting same files triggers change
    pickFiles.click();
  });
}
if (btnChooseFolder && pickFolder) {
  btnChooseFolder.addEventListener('click', () => {
    pickFolder.value = '';
    pickFolder.click();
  });
}

// Useful for debugging / integrating next stage
function logFiles(list) {
  const arr = Array.from(list).map(f => `${f.name} (${f.size} bytes)`);
  console.log('Selected:', arr);
}

pickFiles?.addEventListener('change', (e) => {
  if (e.target.files?.length) logFiles(e.target.files);
});

pickFolder?.addEventListener('change', (e) => {
  if (e.target.files?.length) logFiles(e.target.files);
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



























