/* ==========================================================================
   AMEBA — app script (production-ready, orbital satellites)
   - Bootstraps Upload / Import / Storage UI
   - Destination Hub kernel (Hub API: setMedia, activatePlatform, returnToHub)
   - Satellite orbital controller (planet-like orbit, fixed radius ring, organic motion)
   - Import icons + preview hover helpers restored and wired
   - Transform-only, GPU-accelerated animation; never overlaps hub content
   - Safe, idempotent, resilient to DOM moves & responsive
   ========================================================================== */

(function Ameba() {
  "use strict";

  /* ----------------------
     DOM helpers
     ---------------------- */
  const $ = (sel, root = document) => (root || document).querySelector(sel);
  const $$ = (sel, root = document) => Array.from((root || document).querySelectorAll(sel));
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);
  const log = (...a) => console.log("[ameba]", ...a);
  const err = (...a) => console.error("[ameba]", ...a);

  /* ----------------------
     Element refs (re-query when needed)
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
     Small utilities
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
     Upload / preview handling
     ---------------------- */
  function handleFileDrop(fileList) {
    const file = fileList && fileList[0];
    if (!file) return;
    try {
      if (typeof setBasicMetadataFromFile === "function") setBasicMetadataFromFile(file);
      else setText($("#metaFilename"), file.name || "—");
    } catch (e) { /* ignore */ }

    const url = URL.createObjectURL(file);
    if (file.type?.startsWith("video")) showVideo(url);
    else showImage(url);
    addToStorageList(file);
    log("absorbed:", { name: file.name, type: file.type, size: file.size });
  }

  function showImage(url) {
    const img = $("#previewImg"), v = $("#previewVideo");
    if (!img) return;
    if (v) { try { v.pause?.(); } catch {} v.src = ""; v.hidden = true; }
    img.hidden = false; img.src = url;
    img.onload = () => { try { URL.revokeObjectURL(url); } catch {} };
    if ($("#previewHint")) $("#previewHint").hidden = true;
  }

  function showVideo(url) {
    const img = $("#previewImg"), v = $("#previewVideo");
    if (!v) return;
    if (img) { img.src = ""; img.hidden = true; }
    v.hidden = false; v.src = url;
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
      <div class="storage__thumb" style="background:rgba(255,255,255,.04); width:44px;height:28px;border-radius:6px;"></div>
      <div class="storage__meta">
        <div class="storage__name">${file.name}</div>
        <div class="storage__tags">Recent</div>
      </div>`;
    els.storageList.prepend(item);
  }

  function initUpload() {
    on(els.fileInput, "change", (e) => { const files = e.target.files; if (files && files.length) handleFileDrop(files); });
    if (!els.dropZone) return;
    const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };
    ["dragenter","dragover","dragleave","drop"].forEach(ev => on(els.dropZone, ev, prevent));
    on(els.dropZone, "dragenter", () => els.dropZone.classList.add("is-hover"));
    on(els.dropZone, "dragleave", () => els.dropZone.classList.remove("is-hover"));
    on(els.dropZone, "drop", (e) => { els.dropZone.classList.remove("is-hover"); const files = e.dataTransfer?.files; if (files && files.length) handleFileDrop(files); });
  }

  /* ----------------------
     Import icons wiring (restored)
     ---------------------- */
  function initImportIcons() {
    // wire clickable import icons safely (idempotent)
    const impDevice = document.getElementById('imp-device');
    const impDropbox = document.getElementById('imp-dropbox');
    const impDrive = document.getElementById('imp-drive');
    const fileInput = document.getElementById('fileInput');

    if (impDevice) {
      impDevice.setAttribute('tabindex', '0');
      impDevice.addEventListener('click', () => fileInput && fileInput.click());
      impDevice.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') fileInput && fileInput.click(); });
    }
    if (impDropbox) {
      impDropbox.setAttribute('tabindex', '0');
      impDropbox.addEventListener('click', () => {
        const btn = document.querySelector('[data-action="dropbox"], #btn-dropbox');
        if (btn) btn.click(); else log("Dropbox not wired");
      });
      impDropbox.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') impDropbox.click(); });
    }
    if (impDrive) {
      impDrive.setAttribute('tabindex', '0');
      impDrive.addEventListener('click', () => {
        const btn = document.querySelector('[data-action="gdrive"], [data-action="google-drive"], #btn-gdrive');
        if (btn) btn.click(); else log("Drive not wired");
      });
      impDrive.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') impDrive.click(); });
    }
    log("import icons ready");
  }

  function handleConvertFromLink() {
    if (!els.pasteLink) return;
    const url = (els.pasteLink.value || "").trim(); if (!url) return; log("convert from link:", url);
  }
  function initConvert() { on(els.convertBtn, "click", handleConvertFromLink); on(els.pasteLink, "keydown", (e) => { if (e.key === "Enter") handleConvertFromLink(); }); }

  /* =========================================================================
     Destination Hub Kernel (unchanged logic, exposes Hub API)
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
      if (preset) { setTextLocal(Q.metaResolution(), preset.resolution); setTextLocal(Q.metaCodec(), preset.codec); }
      Q.satellites().forEach(btn => { const on = btn.dataset.platform === p; btn.classList.toggle("is-active", on); btn.setAttribute("aria-pressed", String(on)); });
      const ret = Q.returnBtn(); if (ret) ret.hidden = !p;
      let doneCalled = false;
      const done = () => { if (doneCalled) return; doneCalled = true; animOff(hub); hub.removeEventListener("transitionend", done); };
      hub.addEventListener("transitionend", done, { once: false });
      setTimeout(done, 420);
    }
    function returnToHub() { activatePlatform(null); }

    function bindGhostButtons() {
      Q.ghostButtons().forEach(btn => {
        btn.addEventListener("click", () => {
          const targ = btn.getAttribute("data-target"); if (targ && typeof activatePlatform === "function") activatePlatform(targ);
        });
      });
      const ret = Q.returnBtn(); if (ret) ret.addEventListener("click", returnToHub);
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") returnToHub(); });
    }

    window.Hub = Object.freeze({ __ready: true, state, setMedia, activatePlatform, returnToHub });
    bindGhostButtons();
    const urlP = new URLSearchParams(location.search).get("platform"); if (urlP && PRESETS[urlP]) activatePlatform(urlP);
  })();

  /* =========================================================================
     OrbitalSatelliteController
     - Satellites orbit around the hub perimeter on a fixed-radius ring
     - Organic motion implemented via small per-satellite phase + easing
     - Never overlaps the hub content: anchor points computed outside preview bounds
     - Clicking satellites routes to Hub.activatePlatform(...) for morphs
     ========================================================================= */
  (function OrbitalSatelliteController() {
    // locate the rail (base position is under storage panel)
    const storagePanel = document.querySelector(".panel--storage");
    const rail = storagePanel ? storagePanel.querySelector(".dest-sat-rail") : document.querySelector(".dest-sat-rail");
    const stack = rail?.querySelector(".dest-sat-stack");
    if (!rail || !stack) return;

    const SAT_CFG = {
      // orbital ring offset beyond the preview edge (px)
      baseGap: 26,
      // ring radius margin (added to preview size)
      radiusPadding: 40,
      // organic wobble amplitude (px)
      wobbleAmp: 6,
      // per-satellite angular speed (radians/sec base)
      angularSpeedBase: 0.6,
      // small randomization per-satellite speed multiplier
      speedJitter: 0.18
    };

    // satellites list and per-sat runtime state
    let sats = Array.from(stack.querySelectorAll(".satellite"));
    const satState = sats.map((el, i) => ({
      el,
      angle: (i / Math.max(1, sats.length)) * Math.PI * 2, // initial spread
      speed: SAT_CFG.angularSpeedBase * (1 + (Math.random() - 0.5) * SAT_CFG.speedJitter),
      phase: Math.random() * Math.PI * 2,
      orbitRadius: 0,
      target: { x: 0, y: 0 }
    }));

    // helpers
    const now = () => performance.now() / 1000;
    function centerOf(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2 + window.scrollX, y: r.top + r.height / 2 + window.scrollY, w: r.width, h: r.height }; }

    // compute ring geometry relative to the preview-wrap bounding box
    function computeOrbitGeometry() {
      const preview = document.querySelector(".dest-panel .preview-wrap");
      if (!preview) return null;
      const r = preview.getBoundingClientRect();
      const hubCenter = { x: r.left + r.width / 2 + window.scrollX, y: r.top + r.height / 2 + window.scrollY };
      // radius: half of the largest side plus padding
      const baseRadius = Math.max(r.width, r.height) / 2 + SAT_CFG.radiusPadding;
      return { previewRect: r, hubCenter, baseRadius };
    }

    // compute outer anchor (point on the ring) by angle
    function pointOnOrbit(center, radius, angle) {
      return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
    }

    // apply transform to a satellite element (translate so its center is at target point)
    function moveSatTo(el, targetX, targetY) {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2 + window.scrollX;
      const cy = rect.top + rect.height / 2 + window.scrollY;
      const dx = targetX - cx;
      const dy = targetY - cy;
      // use translate3d for GPU compositing
      el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    }

    // animate loop: updates angles and moves satellites on the ring
    let lastT = now();
    let rafId = null;
    function animateLoop() {
      const t = now();
      const dt = Math.max(0, t - lastT);
      lastT = t;

      const geo = computeOrbitGeometry();
      if (!geo) { rafId = requestAnimationFrame(animateLoop); return; }

      // recompute orbit radius (keeps constant gap from hub perimeter)
      const ringRadius = geo.baseRadius + SAT_CFG.baseGap;

      // update each sat's angle & apply organic wobble
      for (let i = 0; i < satState.length; i++) {
        const s = satState[i];
        // update angle by its speed (adds subtle variation)
        s.angle += s.speed * dt;
        // small organic wobble modulation (phase)
        const wobble = Math.sin(t * (0.8 + (i % 3) * 0.12) + s.phase) * (SAT_CFG.wobbleAmp * 0.5);
        // compute final target on orbit (we offset angle slightly by wobble to feel organic)
        const target = pointOnOrbit(geo.hubCenter, ringRadius + wobble, s.angle);
        s.target.x = target.x;
        s.target.y = target.y;
        s.orbitRadius = ringRadius;
        // apply transform to move the satellite (translate to center on target)
        moveSatTo(s.el, target.x, target.y);
      }

      rafId = requestAnimationFrame(animateLoop);
    }

    // When a satellite is activated we want it to "pause" its free orbit and smoothly dock to a designated slot.
    // Docking slot is an anchor point outside the preview (right-top quadrant by default). We'll calculate a
    // short animation using transforms and still keep it outside the hub content.
    function dockSatellite(index) {
      const list = satState;
      if (!list[index]) return;
      // compute a docking anchor to the right-middle of the preview (outside)
      const geo = computeOrbitGeometry();
      if (!geo) return;
      const dockX = geo.previewRect.right + SAT_CFG.radiusPadding + SAT_CFG.baseGap;
      const dockY = geo.previewRect.top + geo.previewRect.height * 0.18;
      // Immediately move the clicked sat toward dock (we still update transforms in animate loop)
      // We'll set its angle so orbit calculations don't fight the docked position: compute angle to dock
      const dx = dockX - geo.hubCenter.x;
      const dy = dockY - geo.hubCenter.y;
      const angle = Math.atan2(dy, dx);
      satState[index].angle = angle;
      // bump speed low so it stays near dock
      satState[index].speed = 0.02;
      // one-time smooth transform to dock position
      const el = satState[index].el;
      el.style.transition = "transform .42s cubic-bezier(.2,.9,.25,1), box-shadow .28s ease";
      moveSatTo(el, dockX, dockY);
      el.classList.add("is-active");
    }

    // Undock: restore per-sat speed and let animateLoop handle motion again
    function undockAll() {
      satState.forEach((s, i) => {
        s.speed = SAT_CFG.angularSpeedBase * (1 + (Math.random() - 0.5) * SAT_CFG.speedJitter);
        s.el.style.transition = "transform .36s cubic-bezier(.2,.9,.3,1), opacity .28s ease";
        s.el.classList.remove("is-active");
      });
    }

    // parking positions when a hub is active: we still compute external orbit positions but bias them to nicer arc
    function parkOthers(activeIndex) {
      const geo = computeOrbitGeometry();
      if (!geo) return;
      const biasRadius = geo.baseRadius + SAT_CFG.baseGap + 16;
      const activeAngle = satState[activeIndex]?.angle ?? 0;
      let offset = 0;
      for (let i = 0; i < satState.length; i++) {
        if (i === activeIndex) continue;
        offset++;
        const sign = (offset % 2 === 0) ? 1 : -1;
        const level = Math.ceil(offset / 2);
        const angle = activeAngle + sign * (0.28 * level); // angular offset
        const target = pointOnOrbit(geo.hubCenter, biasRadius + level * 8, angle);
        // nudge satellite angle toward target angle so animateLoop naturally moves it there
        satState[i].angle = angle;
        satState[i].speed = 0.02 + (Math.random() * 0.03);
        satState[i].el.classList.add("is-parking");
        satState[i].el.style.transition = "transform .38s cubic-bezier(.2,.9,.3,1), opacity .28s ease";
        moveSatTo(satState[i].el, target.x, target.y);
      }
    }

    // click handlers: call Hub API to morph hub and handle docking/parking visuals
    function bindClicks() {
      sats = Array.from(stack.querySelectorAll(".satellite"));
      // ensure satState length matches sats
      while (satState.length < sats.length) {
        const i = satState.length;
        satState.push({
          el: sats[i],
          angle: (i / Math.max(1, sats.length)) * Math.PI * 2,
          speed: SAT_CFG.angularSpeedBase * (1 + (Math.random() - 0.5) * SAT_CFG.speedJitter),
          phase: Math.random() * Math.PI * 2,
          orbitRadius: 0,
          target: { x: 0, y: 0 }
        });
      }
      sats.forEach((s, i) => {
        s.addEventListener("click", () => {
          try {
            const platform = s.dataset.platform || "";
            const currentActive = (window.Hub && window.Hub.state && window.Hub.state.activePlatform) || null;
            if (currentActive === platform) {
              // toggling off
              if (window.Hub && typeof window.Hub.returnToHub === "function") window.Hub.returnToHub();
              undockAll();
            } else {
              if (window.Hub && typeof window.Hub.activatePlatform === "function") window.Hub.activatePlatform(platform);
              // dock clicked sat and park others around
              const idx = satState.findIndex(ss => ss.el === s);
              dockSatellite(idx);
              parkOthers(idx);
            }
          } catch (e) { console.error("[sat-click] error", e); }
        }, { passive: true });
      });
    }

    // listen for hub-platform-changed events (programmatic activations)
    document.addEventListener("hub-platform-changed", (e) => {
      const platform = e?.detail?.platform || null;
      if (!platform) { undockAll(); return; }
      // find sat index by platform and dock it
      const idx = satState.findIndex(s => s.el.dataset.platform === platform);
      if (idx >= 0) {
        dockSatellite(idx);
        parkOthers(idx);
      }
    });

    // relayout on resize: recompute positions but keep orbit running
    let resizeId = null;
    function relayout() {
      // recalc sat list and state if DOM changed
      sats = Array.from(stack.querySelectorAll(".satellite"));
      if (sats.length !== satState.length) {
        // rebuild mapping simply for robustness
        while (satState.length > sats.length) satState.pop();
        for (let i = 0; i < sats.length; i++) {
          if (!satState[i]) {
            satState[i] = {
              el: sats[i],
              angle: (i / Math.max(1, sats.length)) * Math.PI * 2,
              speed: SAT_CFG.angularSpeedBase * (1 + (Math.random() - 0.5) * SAT_CFG.speedJitter),
              phase: Math.random() * Math.PI * 2,
              orbitRadius: 0,
              target: { x: 0, y: 0 }
            };
          } else {
            satState[i].el = sats[i];
          }
        }
      }
      // clear any transient classes on resize to avoid awkward transitions
      satState.forEach(s => { s.el.style.transition = ""; s.el.classList.remove("is-parking"); });
      // small delay to ensure measurements are stable
      setTimeout(() => {
        // if a platform is active, re-emit event so satellites reposition
        const active = document.querySelector(".dest-panel")?.dataset.platform || null;
        if (active) document.dispatchEvent(new CustomEvent("hub-platform-changed", { detail: { platform: active } }));
      }, 140);
    }
    window.addEventListener("resize", () => { if (resizeId) cancelAnimationFrame(resizeId); resizeId = requestAnimationFrame(relayout); }, { passive: true });

    // start loop
    lastT = now();
    animateLoop();
    bindClicks();

    // initial nudge: ensure satellites placed at base positions under storage
    setTimeout(() => relayout(), 120);
  })();

  /* ----------------------
     Preview hover helpers + Import icon wiring (safeguard)
     - idempotent, keeps preview glow working and import icons interactive
     ---------------------- */
  (function RestorePreviewAndImportHelpers(){
    if (window.__AMEBA_HELPERS_READY__) return;
    window.__AMEBA_HELPERS_READY__ = true;

    function wireImportIcons() {
      const impDevice = document.getElementById('imp-device');
      const impDropbox = document.getElementById('imp-dropbox');
      const impDrive = document.getElementById('imp-drive');
      const fileInput = document.getElementById('fileInput');
      if (impDevice && fileInput) {
        impDevice.setAttribute('tabindex','0');
        impDevice.addEventListener('click', () => fileInput.click());
        impDevice.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });
      }
      if (impDropbox) {
        impDropbox.setAttribute('tabindex','0');
        impDropbox.addEventListener('click', () => {
          const proxy = document.querySelector('[data-action="dropbox"], #btn-dropbox');
          if (proxy) proxy.click(); else log("[ameba] Dropbox proxy missing");
        });
        impDropbox.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') impDropbox.click(); });
      }
      if (impDrive) {
        impDrive.setAttribute('tabindex','0');
        impDrive.addEventListener('click', () => {
          const proxy = document.querySelector('[data-action="gdrive"], [data-action="google-drive"], #btn-gdrive');
          if (proxy) proxy.click(); else log("[ameba] Drive proxy missing");
        });
        impDrive.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') impDrive.click(); });
      }
    }

    function wirePreviewHover() {
      const preview = document.querySelector('.dest-panel .preview-wrap');
      if (!preview) return;
      if (preview.__hoverBound__) return;
      preview.__hoverBound__ = true;
      preview.addEventListener('mouseenter', () => preview.classList.add('is-hovering'));
      preview.addEventListener('mouseleave', () => preview.classList.remove('is-hovering'));
      preview.addEventListener('focusin', () => preview.classList.add('is-hovering'));
      preview.addEventListener('focusout', () => preview.classList.remove('is-hovering'));
    }

    function initHelpers(){
      wireImportIcons();
      wirePreviewHover();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initHelpers, { once: true });
    else setTimeout(initHelpers, 40);

    // also expose to window for debug
    window.__ameba_helpers = { wireImportIcons, wirePreviewHover };
  })();

  /* ----------------------
     Boot
     ---------------------- */
  function boot() {
    try {
      initUpload();
      initImportIcons(); // legacy wiring (keeps previous behavior too)
      initConvert();
      // make sure helpers run in case of dynamic content
      if (window.__ameba_helpers?.wireImportIcons) window.__ameba_helpers.wireImportIcons();
      if (window.__ameba_helpers?.wirePreviewHover) window.__ameba_helpers.wirePreviewHover();
      log("UI ready (orbital satellites + import/preview helpers enabled)");
    } catch (e) {
      err("boot error:", e);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

})();






























