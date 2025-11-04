/* ==========================================================================
   AMEBA — patched production script
   - Robust initialization for orbital satellites
   - Keeps import goo and preview hover helpers intact
   - Preserves Hub kernel (activatePlatform / returnToHub)
   ========================================================================== */

(function Ameba() {
  "use strict";

  const $ = (sel, root = document) => (root || document).querySelector(sel);
  const $$ = (sel, root = document) => Array.from((root || document).querySelectorAll(sel));
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);
  const log = (...a) => console.log("[ameba]", ...a);
  const err = (...a) => console.error("[ameba]", ...a);

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

  const setText = (el, v) => { if (el) el.textContent = v ?? "—"; };
  const fmtTime = (sec) => {
    if (!isFinite(sec)) return "—";
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    const m = Math.floor((sec / 60) % 60).toString().padStart(2, "0");
    const h = Math.floor(sec / 3600);
    return h ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  function handleFileDrop(fileList) {
    const file = fileList && fileList[0];
    if (!file) return;
    try { if (typeof setBasicMetadataFromFile === "function") setBasicMetadataFromFile(file); else setText($("#metaFilename"), file.name || "—"); } catch (e) {}
    const url = URL.createObjectURL(file);
    if (file.type?.startsWith("video")) showVideo(url); else showImage(url);
    addToStorageList(file);
    log("absorbed:", { name: file.name, type: file.type, size: file.size });
  }
  function showImage(url) {
    const img = $("#previewImg"), v = $("#previewVideo");
    if (!img) return;
    if (v) { try { v.pause?.(); } catch {} v.src = ""; v.hidden = true; }
    img.hidden = false; img.src = url; img.onload = () => { try { URL.revokeObjectURL(url); } catch {} };
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
    item.innerHTML = `
      <div class="storage__thumb" style="background:rgba(255,255,255,.04); width:44px;height:28px;border-radius:6px;"></div>
      <div class="storage__meta"><div class="storage__name">${file.name}</div><div class="storage__tags">Recent</div></div>`;
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

  function initImportIcons() {
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
        const btn = document.querySelector('[data-action="dropbox"], #btn-dropbox');
        if (btn) btn.click(); else log("Dropbox not wired");
      });
      impDropbox.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') impDropbox.click(); });
    }
    if (impDrive) {
      impDrive.setAttribute('tabindex','0');
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

  (function OrbitalSatelliteController() {
    const storagePanel = document.querySelector(".panel--storage");
    const rail = storagePanel ? storagePanel.querySelector(".dest-sat-rail") : document.querySelector(".dest-sat-rail");
    const stack = rail?.querySelector(".dest-sat-stack");
    if (!rail || !stack) return;

    const SAT_CFG = { baseGap: 26, radiusPadding: 40, wobbleAmp: 6, angularSpeedBase: 0.6, speedJitter: 0.18 };

    let sats = Array.from(stack.querySelectorAll(".satellite"));
    const satState = sats.map((el, i) => ({
      el,
      angle: (i / Math.max(1, sats.length)) * Math.PI * 2,
      speed: SAT_CFG.angularSpeedBase * (1 + (Math.random() - 0.5) * SAT_CFG.speedJitter),
      phase: Math.random() * Math.PI * 2,
      orbitRadius: 0,
      target: { x: 0, y: 0 }
    }));

    const now = () => performance.now() / 1000;
    function centerOf(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width/2 + window.scrollX, y: r.top + r.height/2 + window.scrollY, w: r.width, h: r.height }; }

    function computeOrbitGeometry() {
      const preview = document.querySelector(".dest-panel .preview-wrap");
      if (!preview) return null;
      const r = preview.getBoundingClientRect();
      const hubCenter = { x: r.left + r.width/2 + window.scrollX, y: r.top + r.height/2 + window.scrollY };
      const baseRadius = Math.max(r.width, r.height)/2 + SAT_CFG.radiusPadding;
      return { previewRect: r, hubCenter, baseRadius };
    }

    function pointOnOrbit(center, radius, angle) { return { x: center.x + Math.cos(angle)*radius, y: center.y + Math.sin(angle)*radius }; }
    function moveSatTo(el, targetX, targetY) {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width/2 + window.scrollX;
      const cy = rect.top + rect.height/2 + window.scrollY;
      const dx = targetX - cx; const dy = targetY - cy;
      el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
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
        satState[i].el.style.transition = "transform .4s cubic-bezier(.2,.9,.25,1), opacity .28s ease";
      }
    }

    let lastT = now();
    let rafId = null;
    function animateLoop() {
      const t = now(); const dt = Math.max(0, t - lastT); lastT = t;
      const geo = computeOrbitGeometry(); if (!geo) { rafId = requestAnimationFrame(animateLoop); return; }
      const ringRadius = geo.baseRadius + SAT_CFG.baseGap;
      for (let i=0;i<satState.length;i++){
        const s = satState[i];
        s.angle += s.speed * dt;
        const wobble = Math.sin(t * (0.8 + (i % 3) * 0.12) + s.phase) * (SAT_CFG.wobbleAmp * 0.45);
        const p = pointOnOrbit(geo.hubCenter, ringRadius + wobble, s.angle);
        s.target.x = p.x; s.target.y = p.y; s.orbitRadius = ringRadius;
        moveSatTo(s.el, p.x, p.y);
      }
      rafId = requestAnimationFrame(animateLoop);
    }

    function dockSatellite(index) {
      const geo = computeOrbitGeometry(); if (!geo || !satState[index]) return;
      const dockX = geo.previewRect.right + SAT_CFG.radiusPadding + SAT_CFG.baseGap;
      const dockY = geo.previewRect.top + geo.previewRect.height * 0.18;
      const angle = Math.atan2(dockY - geo.hubCenter.y, dockX - geo.hubCenter.x);
      satState[index].angle = angle; satState[index].speed = 0.02;
      const el = satState[index].el; el.style.transition = "transform .42s cubic-bezier(.2,.9,.25,1), box-shadow .28s ease";
      moveSatTo(el, dockX, dockY); el.classList.add("is-active");
    }
    function undockAll() { satState.forEach(s => { s.speed = SAT_CFG.angularSpeedBase * (1 + (Math.random()-0.5) * SAT_CFG.speedJitter); s.el.style.transition = "transform .36s cubic-bezier(.2,.9,.3,1), opacity .28s ease"; s.el.classList.remove("is-active"); s.el.classList.remove("is-parking"); }); }
    function parkOthers(activeIndex) {
      const geo = computeOrbitGeometry(); if (!geo) return;
      const biasRadius = geo.baseRadius + SAT_CFG.baseGap + 16;
      const activeAngle = satState[activeIndex]?.angle ?? 0; let offset=0;
      for (let i=0;i<satState.length;i++){ if (i===activeIndex) continue; offset++; const sign = (offset%2===0)?1:-1; const level = Math.ceil(offset/2); const angle = activeAngle + sign*(0.28*level); const target = pointOnOrbit(geo.hubCenter, biasRadius + level*8, angle); satState[i].angle = angle; satState[i].speed = 0.02 + (Math.random()*0.03); satState[i].el.classList.add("is-parking"); satState[i].el.style.transition = "transform .38s cubic-bezier(.2,.9,.3,1), opacity .28s ease"; moveSatTo(satState[i].el, target.x, target.y); }
    }

    function bindClicks() {
      sats = Array.from(stack.querySelectorAll(".satellite"));
      if (sats.length !== satState.length) {
        const newState = sats.map((el,i) => {
          const existing = satState[i];
          return existing ? Object.assign(existing, { el }) : { el, angle: (i / Math.max(1,sats.length))*Math.PI*2, speed: SAT_CFG.angularSpeedBase*(1+(Math.random()-0.5)*SAT_CFG.speedJitter), phase: Math.random()*Math.PI*2, orbitRadius:0, target:{x:0,y:0} };
        });
        satState.length = 0; satState.push(...newState);
      }
      sats.forEach((s,i) => {
        s.addEventListener('click', () => {
          try {
            const platform = s.dataset.platform || "";
            const currentActive = (window.Hub && window.Hub.state && window.Hub.state.activePlatform) || null;
            if (currentActive === platform) { if (window.Hub && typeof window.Hub.returnToHub === "function") window.Hub.returnToHub(); undockAll(); }
            else { if (window.Hub && typeof window.Hub.activatePlatform === "function") window.Hub.activatePlatform(platform); const idx = satState.findIndex(ss => ss.el === s); dockSatellite(idx); parkOthers(idx); }
          } catch (e) { console.error("[sat-click] error", e); }
        }, { passive: true });
      });
    }

    document.addEventListener("hub-platform-changed", (e) => {
      const platform = e?.detail?.platform || null;
      if (!platform) { undockAll(); return; }
      const idx = satState.findIndex(s => s.el.dataset.platform === platform);
      if (idx >= 0) { dockSatellite(idx); parkOthers(idx); }
    });

    let resizeId = null;
    function relayout() {
      sats = Array.from(stack.querySelectorAll(".satellite"));
      if (sats.length !== satState.length) {
        const newState = sats.map((el,i) => ({ el, angle: (i / Math.max(1,sats.length))*Math.PI*2, speed: SAT_CFG.angularSpeedBase*(1+(Math.random()-0.5)*SAT_CFG.speedJitter), phase: Math.random()*Math.PI*2, orbitRadius:0, target:{x:0,y:0} }));
        satState.length = 0; satState.push(...newState);
      }
      satState.forEach(s => { s.el.style.transition = ""; s.el.classList.remove("is-parking"); });
      setTimeout(() => { const active = document.querySelector(".dest-panel")?.dataset.platform || null; if (active) document.dispatchEvent(new CustomEvent("hub-platform-changed",{detail:{platform:active}})); else placeInitialRestingPositions(); }, 140);
    }
    window.addEventListener("resize", () => { if (resizeId) cancelAnimationFrame(resizeId); resizeId = requestAnimationFrame(relayout); }, { passive: true });

    placeInitialRestingPositions(); lastT = now(); animateLoop(); bindClicks(); setTimeout(() => { relayout(); }, 160);
  })();

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

    function initHelpers(){ wireImportIcons(); wirePreviewHover(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initHelpers, { once: true });
    else setTimeout(initHelpers, 40);

    window.__ameba_helpers = { wireImportIcons, wirePreviewHover };
  })();

  function boot() {
    try {
      initUpload();
      initImportIcons();
      initConvert();
      if (window.__ameba_helpers?.wireImportIcons) window.__ameba_helpers.wireImportIcons();
      if (window.__ameba_helpers?.wirePreviewHover) window.__ameba_helpers.wirePreviewHover();
      log("UI ready (orbital satellites + import/preview helpers enabled)");
    } catch (e) { err("boot error:", e); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

})();





























