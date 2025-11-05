/* ==========================================================================
   AMEBA — production script (fixed satellite anchors, stabilized layout)
   - Top panels spacing stabilized
   - Destination hub is main panel; satellites are fixed-position hover nodes outside the hub border
   - Satellites do NOT orbit; they snap to fixed anchor slots defined relative to the hub rectangle
   - Rail is detached to the overlay (document.body) so satellites never affect layout
   - Upload dropzone and Import goo wiring preserved (idempotent)
   - All IDs/classes/function names and script order preserved
   ========================================================================== */

(function Ameba() {
  "use strict";

  const $ = (sel, root = document) => (root || document).querySelector(sel);
  const $$ = (sel, root = document) => Array.from((root || document).querySelectorAll(sel));
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);
  const log = (...a) => console.log("[ameba]", ...a);
  const err = (...a) => console.error("[ameba]", ...a);

  /* ----------------------
     Element refs (re-query when needed)
     ---------------------- */
  const refs = {
    fileInput:  () => document.getElementById("fileInput"),
    dropZone:   () => document.getElementById("dropzone"),
    pasteLink:  () => document.getElementById("paste-input"),
    convertBtn: () => document.getElementById("convert-btn"),

    previewImg:   () => document.getElementById("previewImg"),
    previewVideo: () => document.getElementById("previewVideo"),
    previewHint:  () => document.getElementById("previewHint"),

    impDevice:  () => document.getElementById("imp-device"),
    impDropbox: () => document.getElementById("imp-dropbox"),
    impDrive:   () => document.getElementById("imp-drive"),

    panels:     () => document.querySelector(".panels"),
    destPanel:  () => document.querySelector(".dest-panel"),
    rail:       () => document.querySelector(".dest-sat-rail"),
    satStack:   () => document.querySelector(".dest-sat-stack")
  };

  /* ----------------------
     Utilities
     ---------------------- */
  const setText = (el, v) => { if (el) el.textContent = v ?? "—"; };
  const fmtTime = (sec) => {
    if (!isFinite(sec)) return "—";
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    const m = Math.floor((sec / 60) % 60).toString().padStart(2, "0");
    const h = Math.floor(sec / 3600);
    return h ? `${h}:${m}:${s}` : `${m}:${s}`;
  };
  const now = () => performance.now() / 1000;

  /* =========================================================================
     Upload / Dropzone (restored, idempotent)
     ========================================================================= */
  function initUpload(){
    if (initUpload.__bound) return;
    initUpload.__bound = true;

    const fileInput = refs.fileInput();
    const dropZone = refs.dropZone();
    const pasteLink = refs.pasteLink();
    const convertBtn = refs.convertBtn();

    if (fileInput) {
      fileInput.addEventListener("change", (e) => {
        const files = e.target.files;
        if (files && files.length) handleFileDrop(files);
      });
    }

    if (dropZone){
      const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };
      ["dragenter","dragover","dragleave","drop"].forEach(ev => dropZone.addEventListener(ev, prevent));
      dropZone.addEventListener("dragenter", () => dropZone.classList.add("dropzone--over"));
      dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dropzone--over"));
      dropZone.addEventListener("drop", (e) => {
        dropZone.classList.remove("dropzone--over");
        const files = e.dataTransfer?.files;
        if (files && files.length) handleFileDrop(files);
      });
    }

    if (convertBtn && pasteLink){
      convertBtn.addEventListener("click", () => {
        const url = (pasteLink.value || "").trim();
        if (!url) return;
        log("convert from link:", url);
        document.dispatchEvent(new CustomEvent("convert-request", { detail: { url } }));
      });
      pasteLink.addEventListener("keydown", (e) => { if (e.key === "Enter") convertBtn.click(); });
    }
  }

  function handleFileDrop(fileList) {
    const file = fileList && fileList[0];
    if (!file) return;
    try {
      if (typeof setBasicMetadataFromFile === "function") setBasicMetadataFromFile(file);
      else setText(document.getElementById("metaFilename"), file.name || "—");
    } catch (e) {}
    const url = URL.createObjectURL(file);
    if (file.type?.startsWith("video")) showVideo(url);
    else showImage(url);
    const storageList = document.getElementById("storage-list");
    if (storageList){
      const item = document.createElement("div"); item.className = "storage__item";
      item.innerHTML = `<div class="storage__thumb" style="background:rgba(255,255,255,.04); width:44px;height:28px;border-radius:6px;"></div>
                        <div class="storage__meta"><div class="storage__name">${file.name}</div></div>`;
      storageList.prepend(item);
    }
  }

  function showImage(url){
    const i = refs.previewImg();
    const v = refs.previewVideo();
    if (!i) return;
    if (v){ try { v.pause?.(); } catch {} v.src = ""; v.hidden = true; }
    i.hidden = false; i.src = url; i.onload = () => { try { URL.revokeObjectURL(url); } catch {} };
    const hint = refs.previewHint(); if (hint) hint.hidden = true;
  }
  function showVideo(url){
    const i = refs.previewImg();
    const v = refs.previewVideo();
    if (!v) return;
    if (i){ i.src = ""; i.hidden = true; }
    v.hidden = false; v.src = url;
    v.onloadedmetadata = () => {
      setText(document.getElementById("metaResolution"), `${v.videoWidth}×${v.videoHeight}`);
      setText(document.getElementById("metaDuration"), fmtTime(v.duration));
      try { URL.revokeObjectURL(url); } catch {}
    };
    const hint = refs.previewHint(); if (hint) hint.hidden = true;
  }

  /* =========================================================================
     Import goo icons wiring (restored)
     ========================================================================= */
  function initImportIcons(){
    if (initImportIcons.__bound) return;
    initImportIcons.__bound = true;

    const impDevice = refs.impDevice();
    const impDropbox = refs.impDropbox();
    const impDrive = refs.impDrive();
    const fileInput = refs.fileInput();

    if (impDevice && fileInput){
      impDevice.setAttribute("tabindex","0");
      impDevice.addEventListener("click", () => fileInput.click());
      impDevice.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") fileInput.click(); });
    }
    if (impDropbox){
      impDropbox.setAttribute("tabindex","0");
      impDropbox.addEventListener("click", () => {
        const proxy = document.querySelector('[data-action="dropbox"], #btn-dropbox');
        if (proxy) proxy.click(); else log("[ameba] dropbox proxy missing");
      });
      impDropbox.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") impDropbox.click(); });
    }
    if (impDrive){
      impDrive.setAttribute("tabindex","0");
      impDrive.addEventListener("click", () => {
        const proxy = document.querySelector('[data-action="gdrive"], [data-action="google-drive"], #btn-gdrive');
        if (proxy) proxy.click(); else log("[ameba] drive proxy missing");
      });
      impDrive.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") impDrive.click(); });
    }
    log("import icons ready");
  }

  /* =========================================================================
     Destination Hub Kernel (unchanged)
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

    const state = { activePlatform: null, media: { url: null, type: null }, lastEdits: Object.create(null) };
    const setTextLocal = (el, v) => { if (el) el.textContent = v ?? "—"; };

    function animOn(hub) { if (!hub) return; hub.classList.add("is-switching"); hub.setAttribute("aria-busy", "true"); }
    function animOff(hub) { if (!hub) return; hub.classList.remove("is-switching"); hub.removeAttribute("aria-busy"); }

    function setMedia(fileOrUrl) {
      const hub = Q.hub(); if (!hub) return;
      const v = Q.previewVideo(), i = Q.previewImg(), hint = Q.previewHint();
      const revokeLater = (url) => { try { URL.revokeObjectURL(url); } catch {} };

      let url = null, mime = "";
      if (typeof fileOrUrl === "string") url = fileOrUrl;
      else if (fileOrUrl && typeof fileOrUrl === "object") { url = URL.createObjectURL(fileOrUrl); mime = fileOrUrl.type || ""; setTextLocal(Q.metaFilename(), fileOrUrl.name || "—"); }
      if (!url) return;

      if ((mime && mime.startsWith("video")) || (!mime && /\.(mp4|mov|webm|mkv)$/i.test(url))) {
        if (i) { i.hidden = true; i.src = ""; }
        if (v) { v.hidden = false; v.src = url; v.onloadedmetadata = () => { setTextLocal(Q.metaResolution(), `${v.videoWidth}×${v.videoHeight}`); setTextLocal(Q.metaDuration(), fmtTime(v.duration)); revokeLater(url); }; }
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
     FixedSatelliteController (replacement behaviour)
     - Satellites are fixed hover nodes anchored to named slots around hub
     - No orbiting animation, no layout participation
     - Repositions when hub geometry or window changes
     ========================================================================= */
  (function FixedSatelliteController() {
    const waitFor = () => document.querySelector('.dest-sat-rail') && document.querySelector('.dest-panel');
    function ready(cb) {
      if (waitFor()) return cb();
      const id = setInterval(() => { if (waitFor()) { clearInterval(id); cb(); } }, 80);
    }

    ready(() => {
      const rail = refs.rail();
      const stack = refs.satStack();
      const dest = refs.destPanel();
      if (!rail || !stack || !dest) return;

      // move rail into overlay so it never affects layout
      if (!rail.__overlay) {
        rail.style.position = 'absolute';
        rail.style.pointerEvents = 'none';
        document.body.appendChild(rail);
        rail.__overlay = true;
      }

      // Predefined anchor "slots" around the hub — named and stable:
      // rightCluster: vertical stack down the right edge (signature)
      // topRight: near top-right corner
      // leftCluster: vertical along left edge (fallback)
      function computeNamedAnchors(hubRect, count) {
        const anchors = [];
        const satGap = Math.max(48, hubRect.height * 0.12);
        const rightX = hubRect.right + 12 + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sat-size")) || 60) / 2;
        const leftX = hubRect.left - 12 - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sat-size")) || 60) / 2;
        // signature right-side cluster (preferred)
        const rightPositions = [0.18, 0.36, 0.5, 0.64, 0.8]; // percentages (top -> bottom)
        for (let i=0;i<rightPositions.length && anchors.length<count;i++){
          anchors.push({ x: rightX, y: hubRect.top + hubRect.height * rightPositions[i] + window.scrollY });
        }
        // if we still need anchors, add top-right
        if (anchors.length < count) anchors.push({ x: hubRect.right + 28, y: hubRect.top + 28 + window.scrollY });
        // fill with left cluster
        let leftIndex = 0;
        while (anchors.length < count) {
          const pct = 0.18 + (leftIndex * 0.14);
          anchors.push({ x: leftX, y: hubRect.top + hubRect.height * pct + window.scrollY });
          leftIndex++;
        }
        return anchors.slice(0, count);
      }

      function positionRailContainerNearHub() {
        const hubRect = dest.getBoundingClientRect();
        const railLeft = Math.round(window.scrollX + hubRect.right + 8);
        const railTop = Math.round(window.scrollY + hubRect.top);
        rail.style.left = `${railLeft}px`;
        rail.style.top = `${railTop}px`;
        // allow children to be interactive
        rail.querySelectorAll('.satellite').forEach(s => s.style.pointerEvents = 'auto');
      }

      function placeSatellites() {
        const hubRect = dest.getBoundingClientRect();
        const sats = Array.from(stack.querySelectorAll('.satellite'));
        if (!sats.length) return;
        const anchors = computeNamedAnchors(hubRect, sats.length);
        sats.forEach((s, i) => {
          const anchor = anchors[i];
          // set transform so center of satellite aligns with anchor
          const rect = s.getBoundingClientRect();
          const cx = rect.left + rect.width/2 + window.scrollX;
          const cy = rect.top + rect.height/2 + window.scrollY;
          const dx = anchor.x - cx;
          const dy = anchor.y - cy;
          // one-off transform; keep a short transition so placement looks clean
          s.style.transition = "transform .22s cubic-bezier(.22,.61,.36,1)";
          s.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
        });
        positionRailContainerNearHub();
      }

      // Click handlers simply activate hub platform (no satellite movement)
      function bindClicks() {
        const sats = Array.from(stack.querySelectorAll('.satellite'));
        sats.forEach(s => {
          s.addEventListener('click', () => {
            try {
              const platform = s.dataset.platform || "";
              const currentActive = (window.Hub && window.Hub.state && window.Hub.state.activePlatform) || null;
              if (currentActive === platform) {
                if (window.Hub && typeof window.Hub.returnToHub === "function") window.Hub.returnToHub();
              } else {
                if (window.Hub && typeof window.Hub.activatePlatform === "function") window.Hub.activatePlatform(platform);
              }
            } catch (e) { console.error("[sat-click] error", e); }
          }, { passive: true });
        });
      }

      // Reposition on layout changes
      let rafId = 0;
      function schedulePlace() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => { rafId = 0; placeSatellites(); });
      }
      window.addEventListener('resize', schedulePlace, { passive: true });
      window.addEventListener('scroll', schedulePlace, { passive: true });
      document.addEventListener('hub-platform-changed', schedulePlace);

      // Expose reposition helper
      window.__ameba_reposition_sat_rail = placeSatellites;

      // init now
      placeSatellites();
      bindClicks();
    });
  })();

  /* ----------------------
     Preview hover helpers (idempotent)
     ---------------------- */
  function wirePreviewHover() {
    const preview = document.querySelector('.dest-panel .preview-wrap');
    if (!preview || preview.__hoverBound__) return;
    preview.__hoverBound__ = true;
    preview.addEventListener('mouseenter', () => preview.classList.add('is-hovering'));
    preview.addEventListener('mouseleave', () => preview.classList.remove('is-hovering'));
    preview.addEventListener('focusin', () => preview.classList.add('is-hovering'));
    preview.addEventListener('focusout', () => preview.classList.remove('is-hovering'));
  }

  /* ----------------------
     Safe boot invocation
     ---------------------- */
  function safeBoot() {
    try {
      initUpload();
      initImportIcons();
      initConvert && initConvert();
    } catch (e) {
      console.error("[ameba] safeBoot error:", e);
    }
    if (window.__ameba_helpers?.wireImportIcons) window.__ameba_helpers.wireImportIcons && window.__ameba_helpers.wireImportIcons();
    if (window.__ameba_helpers?.wirePreviewHover) window.__ameba_helpers.wirePreviewHover && window.__ameba_helpers.wirePreviewHover();
    wirePreviewHover();
    // ensure satellites positioned after everything
    setTimeout(() => { if (typeof window.__ameba_reposition_sat_rail === "function") window.__ameba_reposition_sat_rail(); }, 160);
    log("safeBoot complete (fixed anchors)");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", safeBoot, { once: true });
  else safeBoot();

  /* Expose debug hooks */
  window.__ameba_debug = {
    initUpload, initImportIcons, handleFileDrop, showImage, showVideo, repositionSatellites: window.__ameba_reposition_sat_rail
  };

})();














