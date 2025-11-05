/* ==========================================================================
   AMEBA — Phase0-safe production script
   - Feature-flag for satellites via body[data-flag="satellites"]
   - Halo layer created inside the dest-panel (for Phase 2)
   - Satellites controller will early-exit if flag is off (no layout coupling)
   - Preserves all existing ids, classes, function names, and script order
   ========================================================================== */

(function Ameba() {
  "use strict";

  const $ = (sel, root = document) => (root || document).querySelector(sel);
  const $$ = (sel, root = document) => Array.from((root || document).querySelectorAll(sel));
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);
  const log = (...a) => console.log("[ameba]", ...a);

  // Feature flag (data attribute on <body>) -- Phase 0: default OFF
  function satellitesEnabled() {
    const v = document.body.getAttribute("data-flag");
    return v === "satellites";
  }

  // tiny public helpers for dev toggling
  window.__ameba_set_satellites_enabled = function (enabled) {
    try {
      if (enabled) document.body.setAttribute("data-flag", "satellites");
      else document.body.removeAttribute("data-flag");
      // reposition / re-init or teardown satellite layer
      if (typeof window.__ameba_reposition_sat_rail === "function") window.__ameba_reposition_sat_rail();
      // when disabling we hide rail container (it remains detached and non-layout affecting)
      const rail = document.querySelector(".dest-sat-rail");
      if (rail) rail.style.display = enabled ? "" : "none";
      console.info("[ameba] satellites enabled:", !!enabled);
    } catch (e) { console.error(e); }
  };

  window.__ameba_toggle_halo_debug = function () {
    const halo = document.querySelector(".dest-panel .dest-halo");
    if (!halo) return console.warn("Halo not present");
    halo.classList.toggle("debug");
    console.info("[ameba] halo debug toggled:", halo.classList.contains("debug"));
  };

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
    destPanel:  () => document.querySelector(".dest-panel"),
    rail:       () => document.querySelector(".dest-sat-rail"),
    satStack:   () => document.querySelector(".dest-sat-stack")
  };

  /* ----------------------
     Minimal Upload import wiring (idempotent)
     ---------------------- */
  function initUpload(){
    if (initUpload.__bound) return; initUpload.__bound = true;
    const fileInput = refs.fileInput(); const dropZone = refs.dropZone(); const pasteLink = refs.pasteLink(); const convertBtn = refs.convertBtn();
    if (fileInput) fileInput.addEventListener("change", (e)=>{ const files=e.target.files; if (files && files.length) handleFileDrop(files); });
    if (dropZone) {
      const prevent=(e)=>{e.preventDefault();e.stopPropagation();};
      ["dragenter","dragover","dragleave","drop"].forEach(ev=>dropZone.addEventListener(ev,prevent));
      dropZone.addEventListener("dragenter", () => dropZone.classList.add("dropzone--over"));
      dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dropzone--over"));
      dropZone.addEventListener("drop", (e) => {
        dropZone.classList.remove("dropzone--over");
        const files = e.dataTransfer?.files;
        if (files && files.length) handleFileDrop(files);
      });
    }
    if (convertBtn && pasteLink) {
      convertBtn.addEventListener("click", ()=>{ const url=(pasteLink.value||"").trim(); if(!url) return; log("convert:",url); document.dispatchEvent(new CustomEvent("convert-request",{detail:{url}})); });
      pasteLink.addEventListener("keydown",(e)=>{ if(e.key==="Enter") convertBtn.click(); });
    }
  }

  function handleFileDrop(fileList){ const file=fileList && fileList[0]; if(!file) return; try{ if(typeof setBasicMetadataFromFile==="function") setBasicMetadataFromFile(file); else document.getElementById("metaFilename") && (document.getElementById("metaFilename").textContent = file.name || "—"); }catch{} const url=URL.createObjectURL(file); if(file.type?.startsWith("video")) showVideo(url); else showImage(url); const storageList=document.getElementById("storage-list"); if(storageList){ const item=document.createElement("div"); item.className="storage__item"; item.innerHTML=`<div class="storage__thumb" style="background:rgba(255,255,255,.04);width:44px;height:28px;border-radius:6px"></div><div class="storage__meta"><div class="storage__name">${file.name}</div></div>`; storageList.prepend(item); } }

  function showImage(url){ const i=refs.previewImg(), v=refs.previewVideo(); if(!i) return; if(v){ try{v.pause?.();}catch{} v.src=""; v.hidden=true; } i.hidden=false; i.src=url; i.onload=()=>{ try{ URL.revokeObjectURL(url); }catch{} }; refs.previewHint() && (refs.previewHint().hidden=true); }
  function showVideo(url){ const i=refs.previewImg(), v=refs.previewVideo(); if(!v) return; if(i){ i.src=""; i.hidden=true; } v.hidden=false; v.src=url; v.onloadedmetadata = ()=>{ document.getElementById("metaResolution") && (document.getElementById("metaResolution").textContent = `${v.videoWidth}×${v.videoHeight}`); document.getElementById("metaDuration") && (document.getElementById("metaDuration").textContent = (function(s){if(!isFinite(s))return "—";const ss=Math.floor(s%60).toString().padStart(2,"0");const mm=Math.floor((s/60)%60).toString().padStart(2,"0");const hh=Math.floor(s/3600);return hh?`${hh}:${mm}:${ss}`:`${mm}:${ss}`;})(v.duration)); try{URL.revokeObjectURL(url);}catch{} }; refs.previewHint() && (refs.previewHint().hidden=true); }

  function initImportIcons(){
    if (initImportIcons.__bound) return; initImportIcons.__bound = true;
    const impDevice = refs.impDevice(), impDropbox = refs.impDropbox(), impDrive = refs.impDrive(), fileInput = refs.fileInput();
    if (impDevice && fileInput){ impDevice.tabIndex = 0; impDevice.addEventListener("click", ()=> fileInput.click()); impDevice.addEventListener("keydown",(e)=>{ if(e.key==="Enter"||e.key===" ") fileInput.click(); }); }
    if (impDropbox){ impDropbox.tabIndex=0; impDropbox.addEventListener("click", ()=>{ const proxy=document.querySelector('[data-action="dropbox"], #btn-dropbox'); if(proxy) proxy.click(); else log("[ameba] dropbox proxy missing"); }); }
    if (impDrive){ impDrive.tabIndex=0; impDrive.addEventListener("click", ()=>{ const proxy=document.querySelector('[data-action="gdrive"], [data-action="google-drive"], #btn-gdrive'); if(proxy) proxy.click(); else log("[ameba] drive proxy missing"); }); }
    log("import icons wired");
  }

  /* =========================================================================
     Hub kernel (unchanged)
     ========================================================================= */
  (function initDestinationHubKernel(){
    if (window.Hub?.__ready) return;
    const Q = {
      hub(){ return document.querySelector(".dest-panel"); },
      previewImg(){ return document.getElementById("previewImg"); },
      previewVideo(){ return document.getElementById("previewVideo"); },
      previewHint(){ return document.getElementById("previewHint"); },
      metaFilename(){ return document.getElementById("metaFilename"); },
      metaDuration(){ return document.getElementById("metaDuration"); },
      metaResolution(){ return document.getElementById("metaResolution"); },
      metaCodec(){ return document.getElementById("metaCodec"); },
      satellites(){ return Array.from(document.querySelectorAll(".dest-sat-rail .satellite")); },
      ghostButtons(){ return Array.from(document.querySelectorAll(".dest-buttons [data-target]")); },
      returnBtn(){ return document.getElementById("satReturn"); }
    };
    const PRESETS = { tiktok:{resolution:"1080×1920",codec:"video/h264; mp4"}, instagram:{resolution:"1080×1350",codec:"video/h264; mp4"}, youtube:{resolution:"1920×1080",codec:"video/h264; mp4"}, reddit:{resolution:"1920×1080",codec:"video/h264; mp4"} };
    const state = { activePlatform:null, media:{url:null,type:null}, lastEdits: Object.create(null) };
    const setTextLocal = (el,v) => { if (el) el.textContent = v ?? "—"; };
    function animOn(hub){ if(!hub) return; hub.classList.add("is-switching"); hub.setAttribute("aria-busy","true"); }
    function animOff(hub){ if(!hub) return; hub.classList.remove("is-switching"); hub.removeAttribute("aria-busy"); }
    function setMedia(fileOrUrl){ const hub=Q.hub(); if(!hub) return; const v=Q.previewVideo(), i=Q.previewImg(), hint=Q.previewHint(); const revokeLater=(url)=>{ try{URL.revokeObjectURL(url);}catch{} }; let url=null,mime=""; if(typeof fileOrUrl==="string") url=fileOrUrl; else if(fileOrUrl&&typeof fileOrUrl==="object"){ url=URL.createObjectURL(fileOrUrl); mime=fileOrUrl.type||""; setTextLocal(Q.metaFilename(), fileOrUrl.name||"—"); } if(!url) return; if((mime&&mime.startsWith("video"))||(!mime&&/\.(mp4|mov|webm|mkv)$/i.test(url))){ if(i){i.hidden=true;i.src="";} if(v){ v.hidden=false; v.src=url; v.onloadedmetadata=()=>{ setTextLocal(Q.metaResolution(), `${v.videoWidth}×${v.videoHeight}`); setTextLocal(Q.metaDuration(), (function(s){ if(!isFinite(s))return "—"; const ss=Math.floor(s%60).toString().padStart(2,"0"); const mm=Math.floor((s/60)%60).toString().padStart(2,"0"); const hh=Math.floor(s/3600); return hh?`${hh}:${mm}:${ss}`:`${mm}:${ss}`; })(v.duration)); revokeLater(url);}; } state.media={url,type:"video"}; } else { if(v){ try{v.pause?.();}catch{} v.hidden=true; v.src=""; } if(i){ i.hidden=false; i.src=url; i.onload=()=>revokeLater(url); } state.media={url,type:"image"} } if(hint) hint.hidden=true; }
    function activatePlatform(platform){ const hub=Q.hub(); if(!hub) return; if(hub.getAttribute("aria-busy")==="true") return; animOn(hub); const p = platform && PRESETS[platform] ? platform : null; hub.dataset.platform = p || ""; state.activePlatform = p; document.dispatchEvent(new CustomEvent("hub-platform-changed",{detail:{platform:p}})); const preset = p ? PRESETS[p] : null; if(preset){ setTextLocal(Q.metaResolution(), preset.resolution); setTextLocal(Q.metaCodec(), preset.codec); } Q.satellites().forEach(btn=>{ const on = btn.dataset.platform===p; btn.classList.toggle("is-active",on); btn.setAttribute("aria-pressed",String(on)); }); const ret = Q.returnBtn(); if(ret) ret.hidden = !p; let doneCalled=false; const done = ()=>{ if(doneCalled) return; doneCalled=true; animOff(hub); hub.removeEventListener("transitionend", done); }; hub.addEventListener("transitionend", done, { once:false }); setTimeout(done, 400); }
    function returnToHub(){ activatePlatform(null); }
    function bindGhostButtons(){ Q.ghostButtons().forEach(btn=>{ btn.addEventListener("click", ()=>{ const targ = btn.getAttribute("data-target"); if(targ && typeof activatePlatform==="function") activatePlatform(targ); }); }); const ret=Q.returnBtn(); if(ret) ret.addEventListener("click", returnToHub); document.addEventListener("keydown", (e)=>{ if(e.key==="Escape") returnToHub(); }); }
    window.Hub = Object.freeze({ __ready:true, state, setMedia, activatePlatform, returnToHub });
    bindGhostButtons();
    const urlP = new URLSearchParams(location.search).get("platform"); if (urlP && PRESETS[urlP]) activatePlatform(urlP);
  })();

  /* =========================================================================
     FixedSatelliteController (Phase 0/1 behavior)
     - If satellites are disabled (body[data-flag] !== "satellites"):
       - Do not run slot assignment or continuous movement.
       - Create Halo element inside hub for Phase 2 (debuggable)
       - Hide rail visually so it doesn't interfere
     - If enabled, place satellites at named anchors (no orbit math)
     ========================================================================= */
  (function FixedSatelliteController() {
    const waitFor = () => document.querySelector('.dest-panel') && document.querySelector('.dest-sat-rail');
    function ready(cb){
      if (waitFor()) return cb();
      const id = setInterval(()=>{ if(waitFor()){ clearInterval(id); cb(); } }, 80);
    }

    ready(() => {
      const dest = refs.destPanel();
      const rail = refs.rail();
      const stack = refs.satStack();
      if (!dest || !rail || !stack) return;

      // 1) HALO: create the halo element INSIDE the dest-panel if not present
      let halo = dest.querySelector(".dest-halo");
      if (!halo) {
        halo = document.createElement("div");
        halo.className = "dest-halo";
        // the halo element sits inside the hub but visually outside using negative inset
        // content is pointer-events:none; slots will be clickable later (they are children)
        halo.setAttribute("aria-hidden", "true");
        dest.appendChild(halo);
      }

      // Ensure rail is overlayed and not in layout
      if (!rail.__overlay) {
        rail.style.position = 'absolute';
        rail.style.pointerEvents = 'none';
        document.body.appendChild(rail);
        rail.__overlay = true;
      }

      // named anchors generator (data-first approach)
      function computeNamedAnchors(hubRect, count) {
        const anchors = [];
        const rightX = hubRect.right + 16 + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sat-size")) || 60) / 2;
        const leftX = hubRect.left - 16 - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sat-size")) || 60) / 2;
        // signature right cluster percentages
        const rightPercents = [0.18, 0.36, 0.54, 0.72, 0.88];
        for (let i = 0; i < rightPercents.length && anchors.length < count; i++) {
          anchors.push({ x: rightX, y: window.scrollY + hubRect.top + hubRect.height * rightPercents[i] });
        }
        // fill left cluster if needed
        let leftIdx = 0;
        while (anchors.length < count) {
          const pct = 0.2 + (leftIdx * 0.14);
          anchors.push({ x: leftX, y: window.scrollY + hubRect.top + hubRect.height * pct });
          leftIdx++;
        }
        return anchors.slice(0, count);
      }

        function placeSatellitesOnce() {
        const hubRect = dest.getBoundingClientRect();
        const sats = Array.from(stack.querySelectorAll('.satellite'));
        if (!sats.length) return;
        const anchors = computeNamedAnchors(hubRect, sats.length);
        sats.forEach((s, i) => {
          const a = anchors[i];
          const rect = s.getBoundingClientRect();
          const cx = rect.left + rect.width/2 + window.scrollX;
          const cy = rect.top + rect.height/2 + window.scrollY;
          const dx = a.x - cx;
          const dy = a.y - cy;
          s.style.transition = "transform .22s cubic-bezier(.22,.61,.36,1)";
          s.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
          // clickable
          s.style.pointerEvents = "auto";
        });
        // rail container: position it near right of hub for consistent base
        const railLeft = Math.round(window.scrollX + hubRect.right + 8);
        const railTop  = Math.round(window.scrollY + hubRect.top);
        rail.style.left = `${railLeft}px`;
        rail.style.top = `${railTop}px`;
      }

      function bindClicks() {
        const sats = Array.from(stack.querySelectorAll(".satellite"));
        sats.forEach(s => {
          s.addEventListener("click", () => {
            try {
              const platform = s.dataset.platform || "";
              const currentActive = (window.Hub && window.Hub.state && window.Hub.state.activePlatform) || null;
              if (currentActive === platform) {
                if (window.Hub && typeof window.Hub.returnToHub === "function") window.Hub.returnToHub();
              } else {
                if (window.Hub && typeof window.Hub.activatePlatform === "function") window.Hub.activatePlatform(platform);
              }
            } catch (e) { console.error("[sat-click]", e); }
          }, { passive: true });
        });
      }

      // Main entry: decide based on feature flag
      function applyState() {
        const enabled = satellitesEnabled();
        // hide rail if disabled
        if (!enabled) {
          rail.style.display = "none";
          // ensure halo is visible for dev verification
          halo.classList.add("debug-hidden"); // not visually outlined by default
        } else {
          rail.style.display = "";
          halo.classList.remove("debug-hidden");
        }
        // always create halo bounds (visual debugging toggled by user)
        halo.classList.remove("debug"); // default off
        // If satellites enabled, place them, else keep halo only
        if (enabled) {
          placeSatellitesOnce();
          bindClicks();
        } else {
          // place halo (no satellites influence layout)
          positionHalo();
        }
      }

      function positionHalo() {
        // halo sits inside hub but visually outside using negative inset; CSS handles look
        // update halo size/position if required (we use CSS absolute inset, so no need for JS)
      }

      // Relayout watchers
      let raf = 0;
      function scheduleApply() {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(()=>{ raf=0; applyState(); });
      }
      window.addEventListener("resize", scheduleApply, { passive: true });
      window.addEventListener("scroll", scheduleApply, { passive: true });
      document.addEventListener("hub-platform-changed", scheduleApply);

      // expose reposition helper
      window.__ameba_reposition_sat_rail = function(){ applyState(); };

      // init
      applyState();
    });
  })();

  /* ----------------------
     Preview hover helper
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
     Safe boot
     ---------------------- */
  function safeBoot() {
    try {
      initUpload();
      initImportIcons();
      initConvert && initConvert();
    } catch (e) { console.error("[ameba] safeBoot error", e); }
    if (window.__ameba_helpers?.wireImportIcons) window.__ameba_helpers.wireImportIcons && window.__ameba_helpers.wireImportIcons();
    if (window.__ameba_helpers?.wirePreviewHover) window.__ameba_helpers.wirePreviewHover && window.__ameba_helpers.wirePreviewHover();
    wirePreviewHover();
    setTimeout(()=>{ if (typeof window.__ameba_reposition_sat_rail === "function") window.__ameba_reposition_sat_rail(); }, 160);
    log("safeBoot complete");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", safeBoot, { once: true });
  else safeBoot();

  /* Expose debug hooks */
  window.__ameba_debug = { initUpload, initImportIcons, handleFileDrop, showImage, showVideo, toggleSatellites: window.__ameba_set_satellites_enabled, toggleHalo: window.__ameba_toggle_halo_debug };

})();












