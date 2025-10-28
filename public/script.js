/* =========================================================
   AMEBA – App bootstrap (safe, idempotent)
   ========================================================= */
(function Ameba() {
  "use strict";

  // ---------- helpers ----------
  const $  = (sel, root=document) => root.querySelector(sel);
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);
  const log = (...a) => console.log("[ameba]", ...a);
  const warn = (...a) => console.warn("[ameba]", ...a);
  const err = (...a) => console.error("[ameba]", ...a);

  // ---------- refs ----------
  const els = {
    // Upload
    fileInput:  $("#fileInput"),
    dropZone:   $("#dropzone"),
    pasteLink:  $("#paste-input"),
    convertBtn: $("#convert-btn"),

    // Preview + metadata
    previewImg:   $("#previewImg"),
    previewVideo: $("#previewVideo"),
    previewHint:  $("#previewHint"),
    metaFilename:   $("#metaFilename"),
    metaDuration:   $("#metaDuration"),
    metaResolution: $("#metaResolution"),
    metaCodec:      $("#metaCodec"),

    // Storage list
    storageList: $("#storage-list"),

    // Import icons
    impDevice:  $("#imp-device"),
    impDropbox: $("#imp-dropbox"),
    impDrive:   $("#imp-drive"),

    // Legacy proxy (optional)
    oldDropbox: $("#btn-dropbox") || document.querySelector('[data-action="dropbox"]'),
    oldGDrive:  $("#btn-gdrive")  || document.querySelector('[data-action="gdrive"], [data-action="google-drive"]')
  };

  // ---------- utils ----------
  const setText = (el, v) => { if (el) el.textContent = v ?? "—"; };
  const fmtTime = (sec) => {
    if (!isFinite(sec)) return "—";
    const s = Math.floor(sec%60).toString().padStart(2,"0");
    const m = Math.floor((sec/60)%60).toString().padStart(2,"0");
    const h = Math.floor(sec/3600);
    return h ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  // -------- preview + metadata --------
  function showImage(url){
    if (!els.previewImg) return;
    if (els.previewVideo) { try{ els.previewVideo.pause?.(); }catch{} els.previewVideo.src = ""; els.previewVideo.hidden = true; }
    els.previewImg.hidden = false;
    els.previewImg.src = url;
    els.previewImg.onload = () => URL.revokeObjectURL(url);
    if (els.previewHint) els.previewHint.hidden = true;
  }

  function showVideo(url){
    if (!els.previewVideo) return;
    if (els.previewImg) { els.previewImg.src = ""; els.previewImg.hidden = true; }
    els.previewVideo.hidden = false;
    els.previewVideo.src = url;
    els.previewVideo.onloadedmetadata = () => {
      setText(els.metaResolution, `${els.previewVideo.videoWidth}×${els.previewVideo.videoHeight}`);
      setText(els.metaDuration, fmtTime(els.previewVideo.duration));
      URL.revokeObjectURL(url);
    };
    if (els.previewHint) els.previewHint.hidden = true;
  }

  // ---------- Storage UI (stub) ----------
  function addToStorageList(file){
    if (!els.storageList || !file) return;
    const item = document.createElement("div");
    item.className = "storage__item";
    item.style.display = "flex";
    item.style.alignItems = "center";
    item.style.gap = "12px";
    item.innerHTML = `
      <div class="storage__thumb" style="background:rgba(255,255,255,.04);
           width:44px;height:28px;border-radius:6px;"></div>
      <div class="storage__meta">
        <div class="storage__name">${file.name}</div>
        <div class="storage__tags">Recent</div>
      </div>`;
    els.storageList.prepend(item);
  }

  // ---------- single intake ----------
  function handleFileDrop(fileList){
  const file = fileList && fileList[0];
  if (!file) return;

  // Guard: only call if provided elsewhere
  try {
    if (typeof setBasicMetadataFromFile === "function") {
      setBasicMetadataFromFile(file);
    } else {
      // Fallback: at least show the filename pill
      setText(els.metaFilename, file.name || "—");
    }
  } catch {}

  const url = URL.createObjectURL(file);
  if (file.type?.startsWith("video")) showVideo(url);
  else showImage(url);

  addToStorageList(file);

  log("absorbed:", { name: file.name, type: file.type, size: file.size });
}


  // ---------- upload init ----------
  function initUpload(){
    on(els.fileInput, "change", (e) => {
      const files = e.target.files;
      if (files && files.length) handleFileDrop(files);
    });

    if (!els.dropZone) return;

    const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };
    ["dragenter","dragover","dragleave","drop"].forEach((ev) => on(els.dropZone, ev, prevent));

    on(els.dropZone, "dragenter", () => els.dropZone.classList.add("is-hover"));
    on(els.dropZone, "dragleave", () => els.dropZone.classList.remove("is-hover"));
    on(els.dropZone, "drop", (e) => {
      els.dropZone.classList.remove("is-hover");
      const files = e.dataTransfer?.files;
      if (files && files.length) handleFileDrop(files);
    });
  }

  // ---------- import icons ----------
  function initImportIcons(){
    // Device → open hidden input
    if (els.impDevice) {
      els.impDevice.addEventListener("click", () => {
        if (!els.fileInput) { warn("fileInput not found"); return; }
        els.fileInput.click();
      });
    }
    // Dropbox/Drive → proxy to legacy (until OAuth wired)
    if (els.impDropbox) {
      els.impDropbox.addEventListener("click", () => {
        if (els.oldDropbox) els.oldDropbox.click();
        else log("Dropbox connect not wired yet");
      });
    }
    if (els.impDrive) {
      els.impDrive.addEventListener("click", () => {
        if (els.oldGDrive) els.oldGDrive.click();
        else log("Google Drive connect not wired yet");
      });
    }
    log("import icons ready", {
      deviceBtn: !!els.impDevice, fileInput: !!els.fileInput,
      dropboxBtn: !!els.impDropbox, legacyDropbox: !!els.oldDropbox,
      driveBtn: !!els.impDrive, legacyDrive: !!els.oldGDrive
    });
  }

  // ---------- paste-link convert (stub) ----------
  async function handleConvertFromLink(){
    if (!els.pasteLink) return;
    const url = (els.pasteLink.value || "").trim();
    if (!url) return;
    try {
      log("convert from link:", url);
      // TODO: POST to backend for fetch/convert, update progress
    } catch (e) { err("convert error:", e); }
  }
  function initConvert(){
    on(els.convertBtn, "click", handleConvertFromLink);
    on(els.pasteLink, "keydown", (e) => { if (e.key === "Enter") handleConvertFromLink(); });
  }

/* =========================================================
   DESTINATION HUB KERNEL (robust, idempotent, animation-safe)
   - Keeps preview nodes persistent (no flicker)
   - Survives DOM moves/animations (re-queries by IDs/classes)
   - Satellites + ghost buttons both call the same controller
   ========================================================= */
(function initDestinationHubKernel(){
  if (window.Hub?.__ready) return;           // prevent double init

  // ---- light DOM map (re-read when needed so moving DOM is safe)
  const Q = {
    hub()            { return document.querySelector(".dest-panel"); },
    previewImg()     { return document.getElementById("previewImg"); },
    previewVideo()   { return document.getElementById("previewVideo"); },
    previewHint()    { return document.getElementById("previewHint"); },
    metaFilename()   { return document.getElementById("metaFilename"); },
    metaDuration()   { return document.getElementById("metaDuration"); },
    metaResolution() { return document.getElementById("metaResolution"); },
    metaCodec()      { return document.getElementById("metaCodec"); },
    satellites()     { return Array.from(document.querySelectorAll(".dest-sat-rail .satellite")); },
    ghostButtons()   { return Array.from(document.querySelectorAll(".dest-buttons [data-target]")); },
    returnBtn()      { return document.getElementById("satReturn"); },
  };

  // ---- minimal state (kept in memory)
  const PRESETS = {
    tiktok:    { resolution:"1080×1920", codec:"video/h264; mp4" },
    instagram: { resolution:"1080×1350", codec:"video/h264; mp4" },
    youtube:   { resolution:"1920×1080", codec:"video/h264; mp4" },
    reddit:    { resolution:"1920×1080", codec:"video/h264; mp4" }
  };
  const state = {
    activePlatform: null,              // null | 'tiktok' | 'instagram' | 'youtube' | 'reddit'
    media: { url:null, type:null },    // 'video' | 'image'
    lastEdits: Object.create(null)     // per-platform user overrides (future)
  };

  // ---- tiny helpers
  const setText = (el, v) => { if (el) el.textContent = v ?? "—"; };
  const fmtTime = (sec) => {
    if (!isFinite(sec)) return "—";
    const s = Math.floor(sec%60).toString().padStart(2,"0");
    const m = Math.floor((sec/60)%60).toString().padStart(2,"0");
    const h = Math.floor(sec/3600);
    return h ? `${h}:${m}:${s}` : `${m}:${s}`;
  };
  const animOn  = (hub)=>{ if(!hub) return; hub.classList.add("is-switching"); hub.setAttribute("aria-busy","true"); };
  const animOff = (hub)=>{ if(!hub) return; hub.classList.remove("is-switching"); hub.removeAttribute("aria-busy"); };

  // ---- public: set media once; keeps nodes persistent (no flicker)
  function setMedia(fileOrUrl){
    const hub = Q.hub(); if (!hub) return;
    const v = Q.previewVideo(), i = Q.previewImg(), hint = Q.previewHint();

    const revokeLater = (url)=>{ try{ URL.revokeObjectURL(url); }catch{} };

    // Accept File or URL string
    let url = null, mime = "";
    if (typeof fileOrUrl === "string") {
      url = fileOrUrl;
    } else if (fileOrUrl && typeof fileOrUrl === "object") {
      url = URL.createObjectURL(fileOrUrl);
      mime = fileOrUrl.type || "";
      setText(Q.metaFilename(), fileOrUrl.name || "—");
    }
    if (!url) return;

    if ((mime && mime.startsWith("video")) || (!mime && /\.(mp4|mov|webm|mkv)$/i.test(url))) {
      if (i){ i.hidden = true; i.src = ""; }
      if (v){
        v.hidden = false;
        v.src = url;
        v.onloadedmetadata = () => {
          setText(Q.metaResolution(), `${v.videoWidth}×${v.videoHeight}`);
          setText(Q.metaDuration(), fmtTime(v.duration));
          revokeLater(url);
        };
      }
      state.media = { url, type: "video" };
    } else {
      if (v){ try{ v.pause?.(); }catch{} v.hidden = true; v.src = ""; }
      if (i){ i.hidden = false; i.src = url; i.onload = () => revokeLater(url); }
      state.media = { url, type: "image" };
    }

    if (hint) hint.hidden = true;
  }

  // ---- core: platform activation (satellites + ghost buttons)
  function activatePlatform(platform){                      // platform|null
    const hub = Q.hub(); if (!hub) return;
    if (hub.getAttribute("aria-busy")==="true") return;     // ignore spam during transition

    // Begin animated swap
    animOn(hub);

    // Visual morph via data-attr (CSS handles layout/shape)
    const p = platform && PRESETS[platform] ? platform : null;
    hub.dataset.platform = p || "";
    state.activePlatform = p;
     
 // notify layout listeners (satellite rail, etc.)
  document.dispatchEvent(new CustomEvent("hub-platform-changed", { detail: { platform: p } }));

    // Reflect preset into visible pills (display-only; true metadata still comes from media)
    const preset = p ? PRESETS[p] : null;
    if (preset){
      setText(Q.metaResolution(), preset.resolution);
      setText(Q.metaCodec(),      preset.codec);
    }

    // Satellites active state + Return button
    Q.satellites().forEach(btn => {
      const on = btn.dataset.platform === p;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", String(on));
    });
    const ret = Q.returnBtn(); if (ret) ret.hidden = !p;

    // Finish transition when CSS completes (fallback timer just in case)
    let doneCalled = false;
    const done = () => { if(doneCalled) return; doneCalled = true; animOff(hub); hub.removeEventListener("transitionend", done); };
    hub.addEventListener("transitionend", done, { once:false });
    setTimeout(done, 320); // fallback guard if no transitionend fires
  }

  function returnToHub(){ activatePlatform(null); }

  // ---- wire events (resilient to DOM moves)
  function bindEventsOnce(){
    // Satellites
    Q.satellites().forEach(btn => {
      btn.addEventListener("click", () => activatePlatform(btn.dataset.platform));
      btn.addEventListener("dblclick", returnToHub);
    });
    // Ghost buttons mirror satellites
    Q.ghostButtons().forEach(btn => {
      btn.addEventListener("click", () => activatePlatform(btn.getAttribute("data-target")));
    });
    // Return pill
    const ret = Q.returnBtn(); if (ret) ret.addEventListener("click", returnToHub);
    // Keyboard escape
    document.addEventListener("keydown", (e)=>{ if (e.key === "Escape") returnToHub(); });
  }

  // ---- expose small API for dev tools / future modules
  window.Hub = Object.freeze({
    __ready: true,
    state,
    setMedia,                  // Hub.setMedia(fileOrUrl)
    activatePlatform,          // Hub.activatePlatform('youtube')
    returnToHub                // Hub.returnToHub()
  });

  // attach once
  bindEventsOnce();
  // optional: deep-link ?platform=yt
  const urlP = new URLSearchParams(location.search).get("platform");
  if (urlP && PRESETS[urlP]) activatePlatform(urlP);
})();

/* =========================================================
   Satellite Layout Controller
   - Positions satellites as an absolute, vertical stack
   - Anchored to hub; reacts to resize and platform changes
   ========================================================= */
(function SatelliteLayout(){
  const hub   = document.querySelector(".dest-panel");
  const rail  = document.querySelector(".dest-sat-rail");
  const stack = rail?.querySelector(".dest-sat-stack");
  if (!hub || !rail || !stack) return;

  const sats = () => Array.from(stack.querySelectorAll(".satellite"));
  const css  = (el) => getComputedStyle(el || document.documentElement);

  function numberVar(el, name, fallback){
    const v = parseFloat(css(el).getPropertyValue(name));
    return Number.isFinite(v) ? v : fallback;
    }

  function applyAbsoluteLayout(){
    stack.classList.add("is-absolute");

    const list = sats();
    if (!list.length) return;

    // Measure hub + tokens
    const hubRect = hub.getBoundingClientRect();
    const satSize = numberVar(document.documentElement, "--sat-size", 60);

    // We distribute N satellites from top to bottom, centered within hub’s height.
    const N = list.length;
    const total = hubRect.height;
    const usable = Math.max(total - satSize, 0);
    const step = (N > 1) ? (usable / (N - 1)) : 0;

    // Set stack height to the hub height so we can position children within it
    stack.style.height = `${Math.round(total)}px`;

    list.forEach((el, i) => {
      el.style.top = `${Math.round(i * step)}px`;
      el.style.left = "0px";
    });
  }

  function clearAbsolute(){
    stack.classList.remove("is-absolute");
    sats().forEach(el => {
      el.style.top = ""; el.style.left = ""; el.style.position = "";
    });
    stack.style.height = "";
  }

  // pick mode based on viewport (mirror CSS breakpoints)
  function layout(){
    const mq = window.matchMedia("(max-width:1100px)");
    if (mq.matches) clearAbsolute(); else applyAbsoluteLayout();
  }

  // listen for hub morph + window resize
  window.addEventListener("resize", layout, { passive: true });
  document.addEventListener("hub-platform-changed", layout);

  // expose tiny API for dev
  window.Hub = {
  ...(window.Hub || {}),
  satellites: {
    relayout: layout,
    setRadius(px){
      document.documentElement.style.setProperty("--orbit-radius", `${px|0}px`);
      layout();
    }
  }
};


  layout();
})();


  // ---------- boot ----------
  function boot(){
    try {
      initUpload();
      initImportIcons();
      initConvert();
      log("UI ready");
    } catch (e) { err("boot error:", e); }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();











































