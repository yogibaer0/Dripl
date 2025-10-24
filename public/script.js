/* =========================================================
   AMEBA – App bootstrap (safe, idempotent)
   ========================================================= */
(function Ameba() {
  "use strict";

  /* -----------------------------
   * DOM helpers
   * --------------------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);

  const log = (...a) => console.log("[ameba]", ...a);
  const warn = (...a) => console.warn("[ameba]", ...a);
  const err = (...a) => console.error("[ameba]", ...a);

  /* -----------------------------
   * Key DOM refs (all optional)
   * --------------------------- */
  const els = {
  // Upload
  fileInput: $("#fileInput"),
  dropZone : $("#dropzone"),
  pasteLink: $("#paste-input"),       // ← fix ID
  convertBtn: $("#convert-btn"),      // ← fix ID

  // Preview + metadata
  previewImg: $("#previewImg"),       // ← fix ID
  previewHint: $("#previewHint"),
  metaFilename: $("#metaFilename"),
  metaDuration: $("#metaDuration"),
  metaResolution: $("#metaResolution"),
  metaCodec: $("#metaCodec"),

  // Import icons
  impDevice: $("#imp-device"),
  impDropbox: $("#imp-dropbox"),
  impDrive: $("#imp-drive"),

  // Optional legacy (likely absent now)
  oldDropbox: $("#btn-dropbox") || $('[data-action="dropbox"]'),
  oldGDrive : $("#btn-gdrive")  || $('[data-action="gdrive"], [data-action="google-drive"]'),
};


  /* =========================================================
     Preview + metadata
     ========================================================= */
  function setPreviewFromFile(file) {
    if (!file || !els.previewImg) return;

    const url = URL.createObjectURL(file);
    els.previewImg.src = url;
    els.previewImg.style.display = "block";
    if (els.previewHint) els.previewHint.style.display = "none";

    // Optional: revoke after image loads to free memory
    els.previewImg.onload = () => URL.revokeObjectURL(url);
  }

  function setMetadata({ name, type }) {
    const setText = (el, value) => { if (el) el.textContent = value ?? "—"; };

    setText(els.metaFilename, name || "—");
    setText(els.metaCodec, type || "—");

    // You can populate these when you parse video in a worker/ffprobe step
    setText(els.metaResolution, "—");
    setText(els.metaDuration, "—");
  }

  /* =========================================================
     Single source of truth: handle files
     ========================================================= */
  function handleFileDrop(fileList) {
    const file = fileList && fileList[0];
    if (!file) return;

    setMetadata(file);
    setPreviewFromFile(file);

    log("absorbed:", file);
    // TODO: enqueue to pipeline, upload temp, etc.
  }

  /* =========================================================
     Upload: local input + dropzone
     ========================================================= */
  function initUpload() {
    // Local file input
    on(els.fileInput, "change", (e) => {
      const files = e.target.files;
      if (files && files.length) handleFileDrop(files);
    });

    // Drag & drop
    if (!els.dropZone) return;

    const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };

    ["dragenter", "dragover", "dragleave", "drop"].forEach((ev) =>
      on(els.dropZone, ev, prevent)
    );

    on(els.dropZone, "dragenter", () => els.dropZone.classList.add("is-hover"));
    on(els.dropZone, "dragleave", () => els.dropZone.classList.remove("is-hover"));
    on(els.dropZone, "drop", (e) => {
      els.dropZone.classList.remove("is-hover");
      const files = e.dataTransfer?.files;
      if (files && files.length) handleFileDrop(files);
    });
  }

  /* =========================================================
     Import icons (goo) — robust wiring
     ========================================================= */
  function initImportIcons() {
  const $ = (id) => document.getElementById(id);
  const deviceBtn  = $("imp-device");
  const dropboxBtn = $("imp-dropbox");
  const driveBtn   = $("imp-drive");
  const fileInput  = $("fileInput");

  const legacyDropbox = $("btn-dropbox") ||
    document.querySelector('[data-action="dropbox"]');
  const legacyDrive = $("btn-gdrive") ||
    document.querySelector('[data-action="gdrive"],[data-action="google-drive"]');

  if (deviceBtn) {
    deviceBtn.addEventListener("click", () => {
      if (!fileInput) { console.warn("[ameba] fileInput not found"); return; }
      fileInput.click();
    });
  }
  if (dropboxBtn) {
    dropboxBtn.addEventListener("click", () => {
      if (legacyDropbox) legacyDropbox.click();
      else console.info("[ameba] Dropbox connect not wired yet");
    });
  }
  if (driveBtn) {
    driveBtn.addEventListener("click", () => {
      if (legacyDrive) legacyDrive.click();
      else console.info("[ameba] Google Drive connect not wired yet");
    });
  }

  console.log("[ameba] import icons ready", {
    deviceBtn: !!deviceBtn, fileInput: !!fileInput,
    dropboxBtn: !!dropboxBtn, legacyDropbox: !!legacyDropbox,
    driveBtn: !!driveBtn, legacyDrive: !!legacyDrive
  });
}



  /* =========================================================
     Paste-link → Convert (Dripl/Ameba Engine)
     ========================================================= */
  async function handleConvertFromLink() {
    if (!els.pasteLink) return;
    const url = (els.pasteLink.value || "").trim();
    if (!url) return;

    try {
      log("convert from link:", url);
      // TODO: call your backend to resolve + fetch/convert
      // const res = await fetch("/api/convert", { method: "POST", body: JSON.stringify({ url })});
      // const job = await res.json();
      // update UI with job.id, progress, etc.
    } catch (e) {
      err("convert error:", e);
    }
  }

  function initConvert() {
    if (els.convertBtn) on(els.convertBtn, "click", handleConvertFromLink);
    if (els.pasteLink) {
      on(els.pasteLink, "keydown", (e) => {
        if (e.key === "Enter") handleConvertFromLink();
      });
    }
  }

  /* =========================================================
     Safety: remove any undefined references from earlier drafts
     ========================================================= */
  // DELETED: any use of `blobOrUrl` (no such global anymore)
  // DELETED: duplicate definitions of handleFileDrop

  /* =========================================================
     Boot
     ========================================================= */
  function boot() {
    try {
      initUpload();
      initImportIcons();
      initConvert();
      log("UI ready");
    } catch (e) {
      err("boot error:", e);
    }
  }

  // Start after DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();











































