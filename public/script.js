/* =========================================================
   AMEBA — Destination Hub Kernel + Satellite Layout
   (safe, idempotent, non-breaking)
   ========================================================= */
(function Ameba(){
  const hub   = document.getElementById("destPanel");

  const Q = {
    hub:      () => hub,
    previewImg: () => document.getElementById("previewImg"),
    previewVideo:() => document.getElementById("previewVideo"),
    previewHint:() => document.getElementById("previewHint"),
    previewWrap:() => document.getElementById("previewWrap"),
    metaFilename:  () => document.getElementById("metaFilename"),
    metaDuration:  () => document.getElementById("metaDuration"),
    metaResolution:() => document.getElementById("metaResolution"),
    metaCodec:     () => document.getElementById("metaCodec"),
    ghosts:        () => Array.from(document.querySelectorAll(".platform-ghosts .ghost")),
    satellites:    () => Array.from(document.querySelectorAll(".dest-sat-rail .satellite")),
    satReturn:     () => document.getElementById("satReturn"),
    btnConvert:    () => document.getElementById("btnConvert"),
  };

  const state = {
    activePlatform: null,      // "tiktok" | "instagram" | "reddit" | "youtube" | null
    mediaUrl: null
  };

  function setText(el, value){ if (el) el.textContent = value ?? "—"; }
  function fmtTime(sec){
    if (!Number.isFinite(sec)) return "—";
    const m = Math.floor(sec / 60), s = Math.round(sec % 60);
    return `${m}:${String(s).padStart(2,"0")}`;
  }

  // ---------- preview + metadata ----------
  function showImage(url){
    const img = Q.previewImg(), vid = Q.previewVideo(), hint = Q.previewHint();
    if (!img || !vid) return;
    vid.hidden = true; vid.removeAttribute("src");
    img.hidden = false; img.src = url;
    img.onload = () => URL.revokeObjectURL(url);
    if (hint) hint.hidden = true;
    setText(Q.metaResolution(), "—");
    setText(Q.metaDuration(), "—");
    setText(Q.metaCodec(), "—");
  }

  function showVideo(url){
    const img = Q.previewImg(), vid = Q.previewVideo(), hint = Q.previewHint();
    if (!img || !vid) return;
    img.hidden = true; img.removeAttribute("src");
    vid.hidden = false; vid.src = url;
    vid.onloadedmetadata = () => {
      setText(Q.metaResolution(), `${vid.videoWidth}×${vid.videoHeight}`);
      setText(Q.metaDuration(), fmtTime(vid.duration));
      setText(Q.metaCodec(), "video/h264; mp4"); // placeholder
      URL.revokeObjectURL(url);
    };
    if (hint) hint.hidden = true;
  }

  function setMedia(file){
    if (!file) return;
    setText(Q.metaFilename(), file.name || "—");
    const url = URL.createObjectURL(file);
    // naive type check
    if ((file.type || "").startsWith("image/")) showImage(url);
    else showVideo(url);
    state.mediaUrl = url;
  }

  // ---------- platform switching ----------
  const activatePlatform = (platform) => {
    const hubEl = Q.hub(); if (!hubEl) return;
    const p = platform || null;

    // visual dataset + state
    hubEl.dataset.platform = p || "";
    state.activePlatform = p;

    // satellite active styles + aria-pressed
    Q.satellites().forEach(btn => {
      const is = btn.dataset.platform === p;
      btn.classList.toggle("is-active", is);
      btn.setAttribute("aria-pressed", String(is));
    });

    // Return pill
    const r = Q.satReturn();
    if (r) r.hidden = !p;

    // notify layout (rail centering, etc.)
    document.dispatchEvent(new CustomEvent("hub-platform-changed", { detail: { platform: p }}));
  };

  const returnToHub = () => activatePlatform(null);

  // ---------- drag-to-convert ----------
  function queueConvert(platform, fileList){
    const file = fileList && fileList[0];
    if (!file) return;
    setMedia(file); // immediate preview
    console.log("[ameba] convert queued →", platform || "(base)", file.name);
    // TODO: POST to backend with { platform, file }
  }

  function wireDragToConvert(){
    const hubEl = Q.hub(); if (!hubEl) return;

    // allow dropping on hub
    ["dragenter","dragover","dragleave","drop"].forEach(ev => {
      hubEl.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); }, false);
    });

    hubEl.addEventListener("dragenter", () => hubEl.classList.add("hub-drop--over"));
    hubEl.addEventListener("dragleave", () => hubEl.classList.remove("hub-drop--over"));
    hubEl.addEventListener("drop", (e) => {
      hubEl.classList.remove("hub-drop--over");
      const files = e.dataTransfer?.files;
      if (!files || !files.length) return;
      if (state.activePlatform) queueConvert(state.activePlatform, files);
      else setMedia(files[0]);
    });

    // satellites as drop targets
    Q.satellites().forEach(btn => {
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

  // ---------- one-time bindings ----------
  function bindEventsOnce(){
    // satellite clicks — always interactive (no need to return to base)
    Q.satellites().forEach(btn => {
      btn.addEventListener("click", () => {
        const plat = btn.dataset.platform || null;
        // re-clicking active satellite returns to base
        if (state.activePlatform === plat) returnToHub();
        else activatePlatform(plat);
      });
    });

    // ghost platform buttons (inside hub)
    Q.ghosts().forEach(b => b.addEventListener("click", () => activatePlatform(b.dataset.platform)));

    // Return pill
    const r = Q.satReturn();
    if (r) r.addEventListener("click", returnToHub);

    // ESC to return
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") returnToHub();
    });

    // Convert button (stub)
    const btn = Q.btnConvert();
    if (btn) btn.addEventListener("click", () => {
      console.log("[ameba] convert button (stub) →", state.activePlatform || "(base)");
    });

    wireDragToConvert();
  }

  bindEventsOnce();

  // expose tiny API (extensible)
  window.Hub = {
    ...(window.Hub || {}),
    state,
    setMedia,
    activatePlatform,
    returnToHub
  };
})();

/* =========================================================
   Satellite Layout Controller
   - absolute vertical spacing, hub-relative
   ========================================================= */
(function SatelliteLayout(){
  const hub   = document.querySelector(".dest-panel");
  const rail  = document.querySelector(".dest-sat-rail");
  const stack = rail?.querySelector(".dest-sat-stack");
  if (!hub || !rail || !stack) return;

  const sats = () => Array.from(stack.querySelectorAll(".satellite"));
  const css  = (el) => getComputedStyle(el || document.documentElement);

  function numberVar(el, name, fallback){
    const v = parseFloat(css(el).getPropertyValue(name));
    return Number.isFinite(v) ? v : fallback;
  }

  function applyAbsoluteLayout(){
    stack.classList.add("is-absolute");
    const list = sats(); if (!list.length) return;

    const hubRect = hub.getBoundingClientRect();
    const satSize = numberVar(document.documentElement, "--sat-size", 60);
    const N = list.length;
    const total = hubRect.height;
    const usable = Math.max(total - satSize, 0);
    const step = (N > 1) ? (usable / (N - 1)) : 0;

    stack.style.height = `${Math.round(total)}px`;
    list.forEach((el, i) => {
      el.style.top = `${Math.round(i * step)}px`;
      el.style.left = "0px";
    });
  }

  function clearAbsolute(){
    stack.classList.remove("is-absolute");
    sats().forEach(el => { el.style.top=""; el.style.left=""; el.style.position=""; });
    stack.style.height = "";
  }

  function layout(){
    const mq = window.matchMedia("(max-width:1100px)");
    if (mq.matches) clearAbsolute(); else applyAbsoluteLayout();
  }

  // relayout on window resize + platform swap
  window.addEventListener("resize", layout, { passive:true });
  document.addEventListener("hub-platform-changed", layout);

  // public tiny API
  window.Hub = {
    ...(window.Hub || {}),
    satellites: {
      relayout: layout,
      setRadius(px){
        document.documentElement.style.setProperty("--orbit-radius", `${px|0}px`);
        layout();
      }
    }
  };

  layout();
})();











































