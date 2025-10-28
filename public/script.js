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

    setBasicMetadataFromFile(file);

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

  // ---------- Satellite morph controller (additive) ----------
  const PRESETS = {
    tiktok:    { label:"TikTok",    resolution:"1080×1920", codec:"video/h264; mp4" },
    instagram: { label:"Instagram", resolution:"1080×1350", codec:"video/h264; mp4" },
    youtube:   { label:"YouTube",   resolution:"1920×1080", codec:"video/h264; mp4" },
    reddit:    { label:"Reddit",    resolution:"1920×1080", codec:"video/h264; mp4" }
  };

  function initSatellites(){
    const hub = document.querySelector(".dest-panel");            // base hub
    const sats = Array.from(document.querySelectorAll(".dest-sat-float .satellite"));
    const btnReturn = document.getElementById("satReturn");
    if (!hub || !sats.length) return;

    // use your existing meta pills
    const metaRes   = document.getElementById("metaResolution");
    const metaCodec = document.getElementById("metaCodec");

    function setActive(platform){
      sats.forEach(b => {
        const on = b.dataset.platform === platform;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", String(on));
      });
    }

    function activate(platform){
      // 1) visually morph the base hub via data attribute (CSS handles shapes/layout)
      hub.dataset.platform = platform || "";

      // 2) reflect preset specs in the visible pills (display-only; your real metadata still populates on load)
      const p = PRESETS[platform];
      if (p){ if (metaRes) metaRes.textContent = p.resolution; if (metaCodec) metaCodec.textContent = p.codec; }

      // 3) toggle active states / Return pill
      setActive(platform);
      if (btnReturn) btnReturn.hidden = !platform;
    }

    // satellites click → morph
    sats.forEach(btn => btn.addEventListener("click", () => activate(btn.dataset.platform)));

    // ghost text buttons mirror satellites (they already exist in your base hub)
    document.querySelectorAll('.dest-buttons [data-target]').forEach(btn => {
      btn.addEventListener("click", () => {
        const platform = btn.getAttribute("data-target");
        const match = document.querySelector(`.dest-sat-float .satellite[data-platform="${platform}"]`);
        if (match) match.click();
      });
    });

    // Return to Hub
    if (btnReturn) btnReturn.addEventListener("click", () => activate(""));

    // Optional: double-click active satellite to reset
    sats.forEach(btn => btn.addEventListener("dblclick", () => activate("")));
  }

  // ---------- boot ----------
  function boot(){
    try {
      initUpload();
      initImportIcons();
      initConvert();
      initSatellites();
      log("UI ready");
    } catch (e) { err("boot error:", e); }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();











































