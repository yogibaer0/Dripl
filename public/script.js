/* ==========================================================================
   AMEBA — app script (production-ready)
   - Bootstraps Upload / Import / Storage UI
   - Destination Hub kernel (Hub API: setMedia, activatePlatform, returnToHub)
   - Satellite transform controller (orbiting, parking, activate -> calls Hub)
   - Safe, idempotent, and resilient to DOM moves
   ========================================================================== */

(function Ameba() {
  "use strict";

  /* ----------------------
     tiny DOM helpers
     ---------------------- */
  const $ = (sel, root = document) => (root || document).querySelector(sel);
  const $$ = (sel, root = document) => Array.from((root || document).querySelectorAll(sel));
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);
  const noop = () => {};

  const log = (...a) => console.log("[ameba]", ...a);
  const warn = (...a) => console.warn("[ameba]", ...a);
  const err = (...a) => console.error("[ameba]", ...a);

  /* ----------------------
     DOM refs (re-read when needed)
     ---------------------- */
  const els = {
    fileInput:  $("#fileInput"),
    dropZone:   $("#dropzone"),
    pasteLink:  $("#paste-input"),
    convertBtn: $("#convert-btn"),

    previewImg:   $("#previewImg"),
    previewVideo: $("#previewVideo"),
    previewHint:  $("#previewHint"),
    metaFilename:   $("#metaFilename"),
    metaDuration:   $("#metaDuration"),
    metaResolution: $("#metaResolution"),
    metaCodec:      $("#metaCodec"),

    storageList: $("#storage-list"),

    impDevice:  $("#imp-device"),
    impDropbox: $("#imp-dropbox"),
    impDrive:   $("#imp-drive")
  };

  /* ----------------------
     small utilities
     ---------------------- */
  const setText = (el, v) => { if (el) el.textContent = v ?? "—"; };
  const fmtTime = (sec) => {
    if (!isFinite(sec)) return "—";
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    const m = Math.floor((sec / 60) % 60).toString().padStart(2, "0");
    const h = Math.floor(sec / 3600);
    return h ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  /* ----------------------
     Upload / drop handling
     ---------------------- */
  function handleFileDrop(fileList) {
    const file = fileList && fileList[0];
    if (!file) return;
    try {
      if (typeof setBasicMetadataFromFile === "function") {
        setBasicMetadataFromFile(file);
      } else {
        setText($("#metaFilename"), file.name || "—");
      }
    } catch (e) { /* ignore */ }

    const url = URL.createObjectURL(file);
    if (file.type?.startsWith("video")) showVideo(url);
    else showImage(url);

    addToStorageList(file);
    log("absorbed:", { name: file.name, type: file.type, size: file.size });
  }

  function showImage(url) {
    const img = $("#previewImg");
    const v = $("#previewVideo");
    if (!img) return;
    if (v) { try { v.pause?.(); } catch {} v.src = ""; v.hidden = true; }
    img.hidden = false;
    img.src = url;
    img.onload = () => { try { URL.revokeObjectURL(url); } catch {} };
    if ($("#previewHint")) $("#previewHint").hidden = true;
  }

  function showVideo(url) {
    const img = $("#previewImg");
    const v = $("#previewVideo");
    if (!v) return;
    if (img) { img.src = ""; img.hidden = true; }
    v.hidden = false;
    v.src = url;
    v.onloadedmetadata = () => {
      setText($("#metaResolution"), `${v.videoWidth}×${v.videoHeight}`);
      setText($("#metaDuration"), fmtTime(v.duration));
      try { URL.revokeObjectURL(url); } catch {}
    };
    if ($("#previewHint")) $("#previewHint").hidden = true;
  }

  function addToStorageList(file) {
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

  function initUpload() {
    on(els.fileInput, "change", (e) => {
      const files = e.target.files;
      if (files && files.length) handleFileDrop(files);
    });

    if (!els.dropZone) return;
    const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };
    ["dragenter", "dragover", "dragleave", "drop"].forEach((ev) => on(els.dropZone, ev, prevent));
    on(els.dropZone, "dragenter", () => els.dropZone.classList.add("is-hover"));
    on(els.dropZone, "dragleave", () => els.dropZone.classList.remove("is-hover"));
    on(els.dropZone, "drop", (e) => {
      els.dropZone.classList.remove("is-hover");
      const files = e.dataTransfer?.files;
      if (files && files.length) handleFileDrop(files);
    });
  }

  function initImportIcons() {
    if (els.impDevice) on(els.impDevice, "click", () => els.fileInput && els.fileInput.click());
    if (els.impDropbox) on(els.impDropbox, "click", () => {
      const btn = document.querySelector('[data-action="dropbox"], #btn-dropbox');
      if (btn) btn.click(); else log("Dropbox connect not wired yet");
    });
    if (els.impDrive) on(els.impDrive, "click", () => {
      const btn = document.querySelector('[data-action="gdrive"], [data-action="google-drive"], #btn-gdrive');
      if (btn) btn.click(); else log("Google Drive connect not wired yet");
    });
    log("import icons ready");
  }

  function handleConvertFromLink() {
    if (!els.pasteLink) return;
    const url = (els.pasteLink.value || "").trim();
    if (!url) return;
    log("convert from link:", url);
    // TODO: implement backend convert flow
  }

  function initConvert() {
    on(els.convertBtn, "click", handleConvertFromLink);
    on(els.pasteLink, "keydown", (e) => { if (e.key === "Enter") handleConvertFromLink(); });
  }

  /* =========================================================================
     DESTINATION HUB KERNEL
     - Hub manages active platform, preview nodes and metadata
     - Exposes Hub.activatePlatform(platform) / Hub.returnToHub()
     ========================================================================= */
  (function initDestinationHubKernel() {
    if (window.Hub?.__ready) return;

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

    const PRESETS = {
      tiktok:    { resolution: "1080×1920", codec: "video/h264; mp4" },
      instagram: { resolution: "1080×1350", codec: "video/h264; mp4" },
      youtube:   { resolution: "1920×1080", codec: "video/h264; mp4" },
      reddit:    { resolution: "1920×1080", codec: "video/h264; mp4" }
    };

    const state = {
      activePlatform: null,
      media: { url: null, type: null },
      lastEdits: Object.create(null)
    };

    const setTextLocal = (el, v) => { if (el) el.textContent = v ?? "—"; };

    function animOn(hub) { if (!hub) return; hub.classList.add("is-switching"); hub.setAttribute("aria-busy", "true"); }
    function animOff(hub) { if (!hub) return; hub.classList.remove("is-switching"); hub.removeAttribute("aria-busy"); }

    function setMedia(fileOrUrl) {
      const hub = Q.hub(); if (!hub) return;
      const v = Q.previewVideo(), i = Q.previewImg(), hint = Q.previewHint();
      const revokeLater = (url) => { try { URL.revokeObjectURL(url); } catch {} };

      let url = null, mime = "";
      if (typeof fileOrUrl === "string") url = fileOrUrl;
      else if (fileOrUrl && typeof fileOrUrl === "object") {
        url = URL.createObjectURL(fileOrUrl);
        mime = fileOrUrl.type || "";
        setTextLocal(Q.metaFilename(), fileOrUrl.name || "—");
      }
      if (!url) return;

      if ((mime && mime.startsWith("video")) || (!mime && /\.(mp4|mov|webm|mkv)$/i.test(url))) {
        if (i) { i.hidden = true; i.src = ""; }
        if (v) {
          v.hidden = false;
          v.src = url;
          v.onloadedmetadata = () => {
            setTextLocal(Q.metaResolution(), `${v.videoWidth}×${v.videoHeight}`);
            setTextLocal(Q.metaDuration(), fmtTime(v.duration));
            revokeLater(url);
          };
        }
        state.media = { url, type: "video" };
      } else {
        if (v) { try { v.pause?.(); } catch {} v.hidden = true; v.src = ""; }
        if (i) { i.hidden = false; i.src = url; i.onload = () => revokeLater(url); }
        state.media = { url, type: "image" };
      }
      if (hint) hint.hidden = true;
    }

    function activatePlatform(platform) {
      const hub = Q.hub(); if (!hub) return;
      if (hub.getAttribute("aria-busy") === "true") return;

      animOn(hub);

      const p = platform && PRESETS[platform] ? platform : null;
      hub.dataset.platform = p || "";
      state.activePlatform = p;

      document.dispatchEvent(new CustomEvent("hub-platform-changed", { detail: { platform: p } }));

      const preset = p ? PRESETS[p] : null;
      if (preset) {
        setTextLocal(Q.metaResolution(), preset.resolution);
        setTextLocal(Q.metaCodec(), preset.codec);
      }

      Q.satellites().forEach(btn => {
        const on = btn.dataset.platform === p;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-pressed", String(on));
      });

      const ret = Q.returnBtn(); if (ret) ret.hidden = !p;

      let doneCalled = false;
      const done = () => { if (doneCalled) return; doneCalled = true; animOff(hub); hub.removeEventListener("transitionend", done); };
      hub.addEventListener("transitionend", done, { once: false });
      setTimeout(done, 400);
    }

    function returnToHub() { activatePlatform(null); }

    function bindGhostButtons() {
      Q.ghostButtons().forEach(btn => {
        btn.addEventListener("click", () => {
          const targ = btn.getAttribute("data-target");
          if (targ && typeof activatePlatform === "function") activatePlatform(targ);
        });
      });
      const ret = Q.returnBtn(); if (ret) ret.addEventListener("click", returnToHub);
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") returnToHub(); });
    }

    window.Hub = Object.freeze({
      __ready: true,
      state,
      setMedia,
      activatePlatform,
      returnToHub
    });

    bindGhostButtons();

    const urlP = new URLSearchParams(location.search).get("platform");
    if (urlP && PRESETS[urlP]) activatePlatform(urlP);
  })();

  /* =========================================================================
     SatelliteTransformController
     - transform-only motion (no layout thrash)
     - satellites base position under Storage panel
     - clicking a satellite calls Hub.activatePlatform(...) so hub morphs occur
     ========================================================================= */
  (function SatelliteTransformController() {
    const storagePanel = document.querySelector(".panel--storage");
    const rail = storagePanel ? storagePanel.querySelector(".dest-sat-rail") : document.querySelector(".dest-sat-rail");
    const stack = rail?.querySelector(".dest-sat-stack");
    const hubEl = () => document.querySelector(".dest-panel");
    if (!rail || !stack) {
      // nothing to wire
      return;
    }

    const sats = () => Array.from(stack.querySelectorAll(".satellite"));

    function centerOf(el) {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2 + window.scrollX, y: r.top + r.height / 2 + window.scrollY, w: r.width, h: r.height };
    }

    // rAF-based transform batcher
    let rafId = null;
    const pending = [];
    function scheduleTransform(node, tx, ty, opts = {}) {
      pending.push({ node, tx, ty, opts });
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        for (const p of pending) {
          const { node, tx, ty, opts } = p;
          const t = `translate(${tx}px, ${ty}px)`;
          node.style.transform = t + (opts.extra || "");
          if (opts.z !== undefined) node.style.zIndex = opts.z;
          if (opts.clsAdd) node.classList.add(opts.clsAdd);
          if (opts.clsRem) node.classList.remove(opts.clsRem);
          if (opts.opacity !== undefined) node.style.opacity = String(opts.opacity);
        }
        pending.length = 0;
      });
    }

    // compute an exterior anchor point (right-side orbit near preview)
    function hubOrbitAnchor() {
      const preview = document.querySelector(".dest-panel .preview-wrap");
      const pRect = preview ? preview.getBoundingClientRect() : document.querySelector(".dest-panel").getBoundingClientRect();
      // pick a point to the right-middle of the preview, slightly outside
      const outward = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sat-size")) || 60) / 2 + 8;
      return {
        clientX: (pRect.right + outward) + window.scrollX,
        clientY: (pRect.top + (pRect.height / 2)) + window.scrollY
      };
    }

    // compute left-of-preview anchor (if you prefer left side) - unused by default but handy
    function hubLeftTopAnchor() {
      const preview = document.querySelector(".dest-panel .preview-wrap");
      const pRect = preview ? preview.getBoundingClientRect() : document.querySelector(".dest-panel").getBoundingClientRect();
      const outward = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sat-size")) || 60) / 2 + 8;
      return {
        clientX: pRect.left - outward + window.scrollX,
        clientY: pRect.top - outward + window.scrollY
      };
    }

    // compute and animate satellites: activeIndex = index of clicked satellite or -1 to reset
    function computeAndAnimate(activeIndex) {
      const list = sats(); if (!list.length) return;

      list.forEach(s => { s.style.transition = "transform .36s cubic-bezier(.2,.9,.3,1), opacity .28s ease"; s.style.willChange = "transform, opacity"; });

      if (activeIndex === -1) {
        // reset to base positions (no transforms)
        list.forEach((s) => {
          scheduleTransform(s, 0, 0, { clsRem: "is-active", clsRem: "is-parking", z: 0, opacity: 1 });
        });
        return;
      }

      const active = list[activeIndex];
      if (!active) return;

      const activeCenter = centerOf(active);

      // anchor to the right side of preview (outer orbit)
      const anchor = hubOrbitAnchor();
      const dxActive = anchor.clientX - activeCenter.x;
      const dyActive = anchor.clientY - activeCenter.y;
      scheduleTransform(active, dxActive, dyActive, { clsAdd: "is-active", clsRem: "is-parking", z: 120, opacity: 1 });

      // others park in a vertical arc around the anchor (alternate above/below)
      const others = list.filter((_, i) => i !== activeIndex);
      const preview = document.querySelector(".dest-panel .preview-wrap");
      const pRect = preview ? preview.getBoundingClientRect() : document.querySelector(".dest-panel").getBoundingClientRect();
      const horizOffset = Math.max(72, pRect.width * 0.42);
      const spacingY = Math.max(activeCenter.h * 1.05, 56);

      for (let i = 0; i < others.length; i++) {
        const s = others[i];
        const sign = (i % 2 === 0) ? -1 : 1;
        const level = Math.ceil((i + 1) / 2);
        const targetX = (pRect.right + horizOffset) + window.scrollX + (sign * 6);
        const targetY = (pRect.top + window.scrollY) + (sign * spacingY * level);
        const center = centerOf(s);
        const dx = targetX - center.x;
        const dy = targetY - center.y;
        scheduleTransform(s, dx, dy, { clsAdd: "is-parking", clsRem: "is-active", z: 100, opacity: 0.98 });
      }
    }

    // helper to find index
    function indexOfSat(el) { return sats().indexOf(el); }

    // bind satellite click handlers — also call Hub API so morphs happen
    function bind() {
      sats().forEach((s) => {
        s.addEventListener("click", () => {
          try {
            const targetPlatform = s.dataset.platform || "";
            const currentActive = (window.Hub && window.Hub.state && window.Hub.state.activePlatform) || null;

            // Toggle: if clicking the currently active sat, return to base hub
            if (currentActive === targetPlatform) {
              if (window.Hub && typeof window.Hub.returnToHub === "function") {
                window.Hub.returnToHub();
              } else {
                const h = document.querySelector(".dest-panel");
                if (h) h.dataset.platform = "";
                document.dispatchEvent(new CustomEvent("hub-platform-changed", { detail: { platform: null } }));
              }
              computeAndAnimate(-1);
            } else {
              if (window.Hub && typeof window.Hub.activatePlatform === "function") {
                window.Hub.activatePlatform(targetPlatform);
              } else {
                const h = document.querySelector(".dest-panel");
                if (h) h.dataset.platform = targetPlatform;
                document.dispatchEvent(new CustomEvent("hub-platform-changed", { detail: { platform: targetPlatform } }));
              }
              const idx = indexOfSat(s);
              computeAndAnimate(idx);
            }
          } catch (err) { console.error("[sat-binder] click error:", err); }
        }, { passive: true });
      });
    }

    // respond to external programmatic changes (Hub.activatePlatform -> hub-platform-changed)
    document.addEventListener("hub-platform-changed", (e) => {
      const p = e?.detail?.platform || null;
      const list = sats();
      if (!list.length) return;
      if (!p) {
        computeAndAnimate(-1);
        return;
      }
      const idx = list.findIndex(b => b.dataset.platform === p);
      computeAndAnimate(idx);
    });

    // relayout on resize; throttle via RAF
    let resizeId = null;
    function relayout() {
      // narrow screens: clear transforms and let stack flow inline under storage
      if (window.matchMedia("(max-width:1100px)").matches) {
        sats().forEach(s => { s.style.transform = ""; s.style.zIndex = ""; s.classList.remove("is-active", "is-parking"); });
        return;
      }
      const list = sats();
      const activePlatform = (document.querySelector(".dest-panel")?.dataset.platform) || "";
      if (!activePlatform) computeAndAnimate(-1);
      else {
        const activeIdx = list.findIndex(b => b.dataset.platform === activePlatform);
        computeAndAnimate(activeIdx);
      }
    }
    window.addEventListener("resize", () => {
      if (resizeId) cancelAnimationFrame(resizeId);
      resizeId = requestAnimationFrame(relayout);
    }, { passive: true });

    bind();

    // initial passive layout
    setTimeout(() => {
      const p = document.querySelector(".dest-panel")?.dataset.platform || "";
      if (p) document.dispatchEvent(new CustomEvent("hub-platform-changed", { detail: { platform: p } }));
      else computeAndAnimate(-1);
    }, 140);
  })();

  /* ----------------------
     boot sequence
     ---------------------- */
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else boot();

})();






































