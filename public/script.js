/* =========================================================
   AMEBA — Kernel for Upload/Preview + Destination Hub
   (idempotent & add-only; safe to drop into existing app)
   ========================================================= */
(function Ameba(){
  // --------- short DOM helpers
  const $  = (sel, el=document) => el.querySelector(sel);
  const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));

  // --------- elements
  const els = {
    dropZone:     $("#dropZone"),
    pasteLink:    $("#pasteLink"),
    uploadType:   $("#uploadType"),
    btnQuick:     $("#btnQuickConvert"),
    fileInput:    $("#fileInput"),
    chosenFiles:  $("#chosenFiles"),

    // hub
    hub:          $("#destPanel"),
    hubReturn:    $("#hubReturn"),
    previewWrap:  $("#previewWrap"),
    previewImg:   $("#previewImg"),
    previewVideo: $("#previewVideo"),
    previewHint:  $("#previewHint"),
    metaFilename: $("#metaFilename"),
    metaDuration: $("#metaDuration"),
    metaResolution:$("#metaResolution"),
    metaCodec:    $("#metaCodec"),
    ghosts:       $$(".platform-ghosts .ghost"),
    btnConvert:   $("#btnConvert"),

    // satellites
    satRail:      $(".dest-sat-rail"),
    satStack:     $(".dest-sat-stack"),
    satellites:   $$(".dest-sat-rail .satellite"),
    satReturn:    $("#satReturn"),
  };

  const state = {
    activePlatform: null, // 'tiktok' | 'instagram' | 'reddit' | 'youtube' | null
    mediaObjectURL: null,
  };

  const setText = (el, v) => { if (el) el.textContent = v ?? "—"; };
  const fmtTime = (sec) => Number.isFinite(sec)
    ? `${Math.floor(sec/60)}:${String(Math.round(sec%60)).padStart(2,"0")}`
    : "—";

  // ======================================================
  // Preview & metadata
  // ======================================================
  function showImage(url){
    if (!els.previewImg || !els.previewVideo) return;
    els.previewVideo.hidden = true;
    els.previewVideo.removeAttribute("src");
    els.previewImg.hidden = false;
    els.previewImg.src = url;
    els.previewImg.onload = () => URL.revokeObjectURL(url);
    if (els.previewHint) els.previewHint.hidden = true;
    setText(els.metaResolution, "—");
    setText(els.metaDuration, "—");
    setText(els.metaCodec, "—");
  }

  function showVideo(url){
    if (!els.previewImg || !els.previewVideo) return;
    els.previewImg.hidden = true;
    els.previewImg.removeAttribute("src");
    els.previewVideo.hidden = false;
    els.previewVideo.src = url;
    els.previewVideo.onloadedmetadata = () => {
      setText(els.metaResolution, `${els.previewVideo.videoWidth}×${els.previewVideo.videoHeight}`);
      setText(els.metaDuration, fmtTime(els.previewVideo.duration));
      setText(els.metaCodec, "video/h264; mp4"); // placeholder
      URL.revokeObjectURL(url);
    };
    if (els.previewHint) els.previewHint.hidden = true;
  }

  function setMedia(file){
    if (!file) return;
    setText(els.metaFilename, file.name || "—");
    const url = URL.createObjectURL(file);
    state.mediaObjectURL = url;
    if ((file.type || "").startsWith("image/")) showImage(url);
    else showVideo(url);
  }

  // ======================================================
  // Platform switching (morphs)
  // ======================================================
  function activatePlatform(platform){
    const p = platform || null;
    els.hub.dataset.platform = p || "";
    state.activePlatform = p;

    // satellites pressed state
    els.satellites.forEach(btn => {
      const is = btn.dataset.platform === p;
      btn.classList.toggle("is-active", is);
      btn.setAttribute("aria-pressed", String(is));
    });

    // return pill
    if (els.hubReturn) els.hubReturn.hidden = !p;
    if (els.satReturn) els.satReturn.hidden = !p;

    // announce to layout controller
    document.dispatchEvent(new CustomEvent("hub-platform-changed", { detail:{ platform:p }}));
  }
  const returnToHub = () => activatePlatform(null);

  // ======================================================
  // Drag-to-convert (hub + satellites)
  // ======================================================
  function queueConvert(platform, fileList){
    const file = fileList && fileList[0];
    if (!file) return;
    setMedia(file); // instant preview
    console.log("[ameba] convert queued →", platform || "(base)", file.name);
    // TODO: send to backend { platform, file }
  }

  function wireDragTargets(){
    // Drop on hub: preview (base) or convert (active)
    ["dragenter","dragover","dragleave","drop"].forEach(ev => {
      els.hub.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); }, false);
    });
    els.hub.addEventListener("dragenter", () => els.hub.classList.add("hub-drop--over"));
    els.hub.addEventListener("dragleave", () => els.hub.classList.remove("hub-drop--over"));
    els.hub.addEventListener("drop", (e) => {
      els.hub.classList.remove("hub-drop--over");
      const files = e.dataTransfer?.files;
      if (!files || !files.length) return;
      if (state.activePlatform) queueConvert(state.activePlatform, files);
      else setMedia(files[0]);
    });

    // Satellites as drop targets
    els.satellites.forEach(btn => {
      ["dragenter","dragover"].forEach(ev => {
        btn.addEventListener(ev, (e) => {
          e.preventDefault(); e.stopPropagation();
          btn.classList.add("is-dragover");
        }, false);
      });
      ["dragleave","drop"].forEach(ev => {
        btn.addEventListener(ev, (e) => {
          e.preventDefault(); e.stopPropagation();
          btn.classList.remove("is-dragover");
        }, false);
      });
      btn.addEventListener("drop", (e) => {
        const files = e.dataTransfer?.files;
        const plat  = btn.dataset.platform;
        if (!files || !files.length || !plat) return;
        activatePlatform(plat);
        queueConvert(plat, files);
      });
    });
  }

  // ======================================================
  // Upload area behaviors
  // ======================================================
  function wireUpload(){
    // File input
    els.fileInput?.addEventListener("change", () => {
      const files = els.fileInput.files;
      els.chosenFiles.textContent = files?.length
        ? Array.from(files).map(f=>f.name).join(", ")
        : "No file chosen";
      if (files && files.length) setMedia(files[0]);
    });

    // Drag area on top upload card (convenience)
    const zone = els.dropZone;
    if (zone){
      ["dragenter","dragover"].forEach(ev => zone.addEventListener(ev, e=>{
        e.preventDefault(); zone.classList.add("is-over");
      }));
      ["dragleave","drop"].forEach(ev => zone.addEventListener(ev, e=>{
        e.preventDefault(); zone.classList.remove("is-over");
      }));
      zone.addEventListener("drop", (e) => {
        const files = e.dataTransfer?.files;
        if (files && files.length) setMedia(files[0]);
      });
    }

    // Paste link quick action (stub)
    els.pasteLink?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        console.log("[ameba] paste-link convert stub →", els.pasteLink.value);
      }
    });

    // Quick convert button (stub)
    els.btnQuick?.addEventListener("click", ()=>{
      console.log("[ameba] quick convert (stub) →", els.uploadType?.value);
    });
  }

  // ======================================================
  // Events
  // ======================================================
  function bindHubEvents(){
    // Satellite clicks
    els.satellites.forEach(btn => {
      btn.addEventListener("click", () => {
        const plat = btn.dataset.platform || null;
        if (state.activePlatform === plat) returnToHub();
        else activatePlatform(plat);
      });
    });

    // Inner ghost buttons
    els.ghosts.forEach(b => b.addEventListener("click", () => activatePlatform(b.dataset.platform)));

    // Returns
    els.hubReturn?.addEventListener("click", returnToHub);
    els.satReturn?.addEventListener("click", returnToHub);

    // ESC returns to base
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") returnToHub(); });

    // Convert (stub)
    els.btnConvert?.addEventListener("click", () => {
      console.log("[ameba] convert button (stub) →", state.activePlatform || "(base)");
    });
  }

  // ======================================================
  // Satellite layout controller (vertical stack centered to hub)
  // ======================================================
  (function SatelliteLayout(){
    const numberVar = (el, name, fallback) => {
      const v = parseFloat(getComputedStyle(el).getPropertyValue(name));
      return Number.isFinite(v) ? v : fallback;
    };

    function applyAbsolute(){
      els.satStack.classList.add("is-absolute");
      const list = els.satellites; if (!list.length) return;

      const hubRect = els.hub.getBoundingClientRect();
      const satSize = numberVar(document.documentElement, "--sat-size", 60);
      const N = list.length;
      const total = hubRect.height;
      const usable = Math.max(total - satSize, 0);
      const step = (N > 1) ? (usable / (N - 1)) : 0;

      els.satStack.style.height = `${Math.round(total)}px`;
      list.forEach((el, i) => {
        el.style.top = `${Math.round(i * step)}px`;
        el.style.left = "0px";
      });
    }

    function clearAbsolute(){
      els.satStack.classList.remove("is-absolute");
      els.satellites.forEach(el => { el.style.top=""; el.style.left=""; el.style.position=""; });
      els.satStack.style.height = "";
    }

    function layout(){
      const mq = window.matchMedia("(max-width:1100px)");
      if (mq.matches) clearAbsolute(); else applyAbsolute();
    }

    window.addEventListener("resize", layout, { passive:true });
    document.addEventListener("hub-platform-changed", layout);
    layout();

    // expose tiny public API for tuning
    window.Hub = { ...(window.Hub||{}),
      satellites:{
        relayout: layout,
        setRadius(px){
          document.documentElement.style.setProperty("--orbit-radius", `${px|0}px`);
          layout();
        }
      }
    };
  })();

  // Kick everything off
  wireUpload();
  wireDragTargets();
  bindHubEvents();

  // public kernel (optional)
  window.Hub = { ...(window.Hub||{}),
    state,
    setMedia,
    activatePlatform,
    returnToHub
  };
})();











































