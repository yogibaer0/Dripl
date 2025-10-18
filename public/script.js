// public/script.js
// ---------- CONFIG read from server-injected <meta> ----------
const META = (name) => document.querySelector(`meta[name="${name}"]`)?.content?.trim() || "";
const SUPABASE_URL = META("supabase-url");
const SUPABASE_ANON_KEY = META("supabase-anon-key");
const API_BASE = META("api-base");

// Safe debug (only a preview of the anon key for logs)
console.log("[dripl] metas", {
  SUPABASE_URL,
  keyPreview: (SUPABASE_ANON_KEY || "").slice(0, 6) + "…",
  API_BASE,
});

// ---------- SUPABASE (UMD loaded from /vendor) ----------
const supaFactory = (window.supabase || window.Supabase);
if (!supaFactory) {
  console.error("[dripl] Supabase UMD not loaded");
} else if (!/^https?:\/\//.test(SUPABASE_URL || "")) {
  console.error("[dripl] Missing/invalid SUPABASE_URL — check Render env + server injection.");
} else {
  window.supa = (supaFactory.createClient || supaFactory)(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.info("[dripl] Supabase ready");
}

// ---------- UI wiring ----------
const qs = (s) => document.querySelector(s);

// Upload controls
const drop = qs("#uploadDrop");
const pasteLink = qs("#pasteLink");
const formatSelect = qs("#formatSelect");
const convertBtn = qs("#convertBtn");

// Import controls
const chooseFilesBtn = qs("#chooseFilesBtn");
const hiddenFileInput = qs("#hiddenFileInput");
const connectDropboxBtn = qs("#connectDropboxBtn");
const connectGDriveBtn = qs("#connectGDriveBtn");

// Storage list placeholder
const storageList = qs("#storageList");

// --- helpers ---
function humanSize(bytes) {
  if (!Number.isFinite(bytes)) return "—";
  const units = ["B","KB","MB","GB","TB"];
  let i = 0, n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 ? 1 : 0)} ${units[i]}`;
}

function listFiles(files = []) {
  if (!storageList) return;
  storageList.setAttribute("aria-busy", "true");
  const frag = document.createDocumentFragment();
  files.forEach(f => {
    const row = document.createElement("div");
    row.className = "storage-row";
    row.innerHTML = `
      <div class="storage-row__name">${f.name}</div>
      <div class="storage-row__meta">${humanSize(f.size)} • ${f.type || "unknown"}</div>
      <button class="btn btn--tiny">Upload</button>
    `;
    // Example: hook upload to Supabase storage later
    row.querySelector("button").addEventListener("click", async () => {
      console.log("[dripl] TODO upload:", f.name);
      // const { data, error } = await window.supa.storage.from('bucket').upload(`path/${f.name}`, f)
      // handle result...
    });
    frag.appendChild(row);
  });
  storageList.innerHTML = "";
  storageList.appendChild(frag);
  storageList.setAttribute("aria-busy", "false");
}

// --- Choose files (local) ---
if (chooseFilesBtn && hiddenFileInput) {
  chooseFilesBtn.addEventListener("click", () => hiddenFileInput.click());
  hiddenFileInput.addEventListener("change", (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    console.log("[dripl] picked files:", files.map(f => f.name));
    listFiles(files);
  });
}

// --- Drag & drop to upload box ---
if (drop) {
  const enter = () => drop.classList.add("dropzone--hover");
  const leave = () => drop.classList.remove("dropzone--hover");

  ["dragenter","dragover"].forEach(evt =>
    drop.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); enter(); })
  );
  ["dragleave","drop"].forEach(evt =>
    drop.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); leave(); })
  );
  drop.addEventListener("drop", (e) => {
    const files = Array.from(e.dataTransfer?.files || []);
    const text = e.dataTransfer?.getData("text")?.trim();
    if (files.length) {
      console.log("[dripl] dropped files:", files.map(f => f.name));
      listFiles(files);
    } else if (text) {
      pasteLink.value = text;
      convertBtn?.click();
    }
  });
}

// --- Convert link (paste + button + Enter) ---
async function handleConvert() {
  const url = pasteLink?.value?.trim();
  if (!url) return;
  const fmt = formatSelect?.value || "mp4";
  console.log(`[dripl] convert request: ${fmt} -> ${url}`);

  // Example call to your API (hook up when ready)
  // await fetch(`${API_BASE || ""}/convert`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, format: fmt }) })

  // For now, surface a friendly toast
  alert("Convert queued (demo) — wire this to your API when ready.");
}

if (convertBtn) convertBtn.addEventListener("click", handleConvert);
if (pasteLink) {
  pasteLink.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleConvert();
  });
}

// --- Third-party import stubs (safe, no errors) ---
function comingSoon(which) {
  alert(`${which} picker coming soon.\nThis button is intentionally a no-op until OAuth is wired.`);
}
connectDropboxBtn?.addEventListener("click", () => comingSoon("Dropbox"));
connectGDriveBtn?.addEventListener("click", () => comingSoon("Google Drive"));

// --- Error softening ---
window.addEventListener("error", (e) => {
  if (String(e?.message || "").includes("Supabase")) {
    console.error("[dripl] runtime:", e.message);
  }
});









































