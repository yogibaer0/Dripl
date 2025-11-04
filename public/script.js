/* ==========================================================================
   AMEBA — patched production script (guarded boot + orbital helpers + upload/import restore)
   - Bootstraps Upload / Import / Storage UI
   - Destination Hub kernel (Hub API: setMedia, activatePlatform, returnToHub)
   - Satellite orbital controller (overlay rail, detached from layout)
   - Import goo + Upload dropzone restored and interactive
   - Safe guarded boot to avoid ReferenceErrors; idempotent bindings
   - No IDs, classes, function names or script order changed; additions are non-destructive
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
     Upload / Dropzone (restored + idempotent)
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
     Destination Hub Kernel (unchanged logic)
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
     OrbitalSatelliteController (overlay rail + orbital motion)
     - detaches the rail to document.body so satellites never affect layout
     ========================================================================= */
  (function OrbitalSatelliteController() {
    // run after DOM ready to ensure elements exist
    const waitFor = () => document.querySelector('.dest-sat-rail') && document.querySelector('.dest-panel');
    function ready(cb) {
      if (waitFor()) return cb();
      const id = setInterval(() => { if (waitFor()) { clearInterval(id); cb(); }}, 80);
    }

    ready(() => {
      const rail = refs.rail();
      const stack = refs.satStack();
      const dest = refs.destPanel();
      if (!rail || !stack || !dest) return;

      // detach rail -> overlay
      if (!rail.__overlay) {
        rail.style.position = "absolute";
        rail.style.pointerEvents = "none";
        document.body.appendChild(rail);
        rail.__overlay = true;
      }

      const SAT_CFG = { baseGap: 26, radiusPadding: 40, wobbleAmp: 6, angularSpeedBase: 0.6, speedJitter: 0.18 };

      let sats = Array.from(stack.querySelectorAll('.satellite'));
      let satState = sats.map((el, i) => ({
        el,
        angle: (i / Math.max(1, sats.length)) * Math.PI * 2,
        speed: SAT_CFG.angularSpeedBase * (1 + (Math.random() - 0.5) * SAT_CFG.speedJitter),
        phase: Math.random() * Math.PI * 2,
        orbitRadius: 0,
        target: { x: 0, y: 0 }
      }));

      function computeOrbitGeometry() {
        const preview = document.querySelector(".dest-panel .preview-wrap");
        if (!preview) return null;
        const r = preview.getBoundingClientRect();
        const hubCenter = { x: r.left + r.width/2 + window.scrollX, y: r.top + r.height/2 + window.scrollY };
        const baseRadius = Math.max(r.width, r.height)/2 + SAT_CFG.radiusPadding;
        return { previewRect: r, hubCenter, baseRadius };
      }

      function pointOnOrbit(center, radius, angle) { return { x: center.x + Math.cos(angle)*radius, y: center.y + Math.sin(angle)*radius }; }

      function moveSatTo(el, tx, ty) {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width/2 + window.scrollX;
        const cy = rect.top + rect.height/2 + window.scrollY;
        const dx = tx - cx, dy = ty - cy;
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      }

      function positionRail() {
        const d = dest.getBoundingClientRect();
        const gutter = 28;
        const top = Math.round(window.scrollY + d.top + (d.height / 2) - (rail.offsetHeight / 2));
        const left = Math.round(window.scrollX + d.right + gutter);
        rail.style.top = `${top}px`;
        rail.style.left = `${left}px`;
        rail.querySelectorAll('.satellite').forEach(s => s.style.pointerEvents = 'auto');
      }

      function placeInitialRestingPositions() {
        const geo = computeOrbitGeometry();
        if (!geo) { setTimeout(placeInitialRestingPositions, 120); return; }
        const ring = geo.baseRadius + SAT_CFG.baseGap;
        const start = (210 * Math.PI)/180;
        const end = (300 * Math.PI)/180;
        const count = Math.max(1, satState.length);
        for (let i=0;i<count;i++){
          const t = count===1?0.5:(i/(count-1 || 1));
          const angle = start + (end - start) * t;
          satState[i].angle = angle;
          const p = pointOnOrbit(geo.hubCenter, ring, angle);
          moveSatTo(satState[i].el, p.x, p.y);
          satState[i].el.style.transition = "transform .36s cubic-bezier(.2,.9,.25,1), opacity .28s ease";
        }
        positionRail();
      }

      let lastT = now();
      function animateLoop() {
        const t = now(); const dt = Math.max(0, t - lastT); lastT = t;
        const geo = computeOrbitGeometry(); if (!geo) { requestAnimationFrame(animateLoop); return; }
        const ringRadius = geo.baseRadius + SAT_CFG.baseGap;
        for (let i=0;i<satState.length;i++){
          const s = satState[i];
          s.angle += s.speed * dt;
          const wobble = Math.sin(t * (0.8 + (i % 3) * 0.12) + s.phase) * (SAT_CFG.wobbleAmp * 0.45);
          const p = pointOnOrbit(geo.hubCenter, ringRadius + wobble, s.angle);
          s.target.x = p.x; s.target.y = p.y; s.orbitRadius = ringRadius;
          moveSatTo(s.el, p.x, p.y);
        }
        requestAnimationFrame(animateLoop);
      }

      function dockSatellite(index) {
        const geo = computeOrbitGeometry(); if (!geo || !satState[index]) return;
        const dockX = geo.previewRect.right + SAT_CFG.radiusPadding + SAT_CFG.baseGap;
        const dockY = geo.previewRect.top + geo.previewRect.height * 0.18;
        const angle = Math.atan2(dockY - geo.hubCenter.y, dockX - geo.hubCenter.x);
        satState[index].angle = angle; satState[index].speed = 0.02;
        const el = satState[index].el; el.style.transition = "transform .42s cubic-bezier(.2,.9,.25,1), box-shadow .28s ease";
        moveSatTo(el, dockX, dockY); el.classList.add("is-active");
        positionRail();
      }

      function undockAll() {
        satState.forEach(s => {
          s.speed = SAT_CFG.angularSpeedBase * (1 + (Math.random()-0.5) * SAT_CFG.speedJitter);
          s.el.style.transition = "transform .36s cubic-bezier(.2,.9,.3,1), opacity .28s ease";
          s.el.classList.remove("is-active"); s.el.classList.remove("is-parking");
        });
      }

      function parkOthers(activeIndex) {
        const geo = computeOrbitGeometry(); if (!geo) return;
        const biasRadius = geo.baseRadius + SAT_CFG.baseGap + 16;
        const activeAngle = satState[activeIndex]?.angle ?? 0; let offset = 0;
        for (let i=0;i<satState.length;i++){
          if (i===activeIndex) continue;
          offset++; const sign = (offset%2===0)?1:-1; const level = Math.ceil(offset/2);
          const angle = activeAngle + sign*(0.28*level);
          const target = pointOnOrbit(geo.hubCenter, biasRadius + level*8, angle);
          satState[i].angle = angle; satState[i].speed = 0.02 + (Math.random()*0.03);
          satState[i].el.classList.add("is-parking");
          satState[i].el.style.transition = "transform .38s cubic-bezier(.2,.9,.3,1), opacity .28s ease";
          moveSatTo(satState[i].el, target.x, target.y);
        }
      }

      function bindClicks() {
        sats = Array.from(stack.querySelectorAll('.satellite'));
        if (sats.length !== satState.length) {
          const newState = sats.map((el,i) => {
            const existing = satState[i];
            return existing ? Object.assign(existing, { el }) : {
              el, angle:(i / Math.max(1,sats.length))*Math.PI*2,
              speed: SAT_CFG.angularSpeedBase*(1+(Math.random()-0.5)*SAT_CFG.speedJitter),
              phase: Math.random()*Math.PI*2, orbitRadius:0, target:{x:0,y:0}
            };
          });
          satState.length = 0; satState.push(...newState);
        }
        sats.forEach((s,i) => {
          s.addEventListener('click', () => {
            try {
              const platform = s.dataset.platform || "";
              const currentActive = (window.Hub && window.Hub.state && window.Hub.state.activePlatform) || null;
              if (currentActive === platform) { if (window.Hub && typeof window.Hub.returnToHub === "function") window.Hub.returnToHub(); undockAll(); }
              else { if (window.Hub && typeof window.Hub.activatePlatform === "function") window.Hub.activatePlatform(platform); const idx = satState.findIndex(ss=>ss.el===s); dockSatellite(idx); parkOthers(idx); }
            } catch (e) { console.error("[sat-click] error", e); }
          }, { passive: true });
        });
      }

      // expose reposition helper
      window.__ameba_reposition_sat_rail = positionRail;

      // initialize
      placeInitialRestingPositions();
      animateLoop();
      bindClicks();

      // reposition listeners
      document.addEventListener("hub-platform-changed", () => { positionRail(); });
      window.addEventListener("resize", () => { positionRail(); });
      window.addEventListener("scroll", () => { positionRail(); });
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
      initUpload();       // restored upload
      initImportIcons();  // restored import goo
      initConvert && initConvert();
    } catch (e) {
      console.error("[ameba] safeBoot error:", e);
    }
    if (window.__ameba_helpers?.wireImportIcons) window.__ameba_helpers.wireImportIcons && window.__ameba_helpers.wireImportIcons();
    if (window.__ameba_helpers?.wirePreviewHover) window.__ameba_helpers.wirePreviewHover && window.__ameba_helpers.wirePreviewHover();
    wirePreviewHover();
    log("safeBoot complete");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", safeBoot, { once: true });
  else safeBoot();

  /* expose debug helpers */
  window.__ameba_debug = {
    initUpload, initImportIcons, handleFileDrop, showImage, showVideo
  };

})();

























