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
    fileInput: $("#fileInput"),                // hidden <input type="file">
    dropZone : $("#dropzone"),                 // drag/drop area
    pasteLink: $("#pasteLinkInput"),           // link input (optional)
    convertBtn: $("#convertBtn"),

    // Preview + metadata (bottom strip)
    previewImg: $("#destPreviewImg"),          // <img> in preview
    previewHint: $("#previewHint"),
    metaFilename: $("#metaFilename"),
    metaDuration: $("#metaDuration"),
    metaResolution: $("#metaResolution"),
    metaCodec: $("#metaCodec"),

    // Import icons (inside goo)
    impDevice: $("#imp-device"),
    impDropbox: $("#imp-dropbox"),
    impDrive: $("#imp-drive"),

    // Optional legacy connect buttons (proxy click)
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
    // Device → open hidden input
    if (els.impDevice && els.fileInput) {
      on(els.impDevice, "click", () => els.fileInput.click());
    } else if (els.impDevice) {
      on(els.impDevice, "click", () => warn("fileInput not found; cannot open picker"));
    }

    // Dropbox → proxy to legacy connect if present
    if (els.impDropbox && els.oldDropbox) {
      on(els.impDropbox, "click", () => els.oldDropbox.click());
    } else if (els.impDropbox) {
      on(els.impDropbox, "click", () => warn("Dropbox connect not wired"));
    }

    // Google Drive → proxy to legacy connect if present
    if (els.impDrive && els.oldGDrive) {
      on(els.impDrive, "click", () => els.oldGDrive.click());
    } else if (els.impDrive) {
      on(els.impDrive, "click", () => warn("Google Drive connect not wired"));
    }
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











































