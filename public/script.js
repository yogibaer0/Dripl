/* =========================================================
   AMEBA – App bootstrap (safe, idempotent)
   ========================================================= */
(function Ameba() {
  "use strict";

  // ---------- helpers ----------
  const $  = (sel, root=document) => root.querySelector(sel);
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);
  const log = (...a) => console.log("[ameba]", ...a);
  const warn = (...a) => console.warn("[ameba]", ...a);
  const err = (...a) => console.error("[ameba]", ...a);

  // ---------- refs ----------
  const els = {
    // Upload
    fileInput:  $("#fileInput"),
    dropZone:   $("#dropzone"),
    pasteLink:  $("#paste-input"),
    convertBtn: $("#convert-btn"),

    // Preview + metadata
    previewImg:   $("#previewImg"),
    previewVideo: $("#previewVideo"),
    previewHint:  $("#previewHint"),
    metaFilename:   $("#metaFilename"),
    metaDuration:   $("#metaDuration"),
    metaResolution: $("#metaResolution"),
    metaCodec:      $("#metaCodec"),

    // Storage list
    storageList: $("#storage-list"),
    recentPreviewRow: $("#recent-previews"),
    // Import icons
    impDevice:  $("#imp-device"),
    impDropbox: $("#imp-dropbox"),
    impDrive:   $("#imp-drive"),

    // Legacy proxy (optional)
    oldDropbox: $("#btn-dropbox") || document.querySelector('[data-action="dropbox"]'),
    oldGDrive:  $("#btn-gdrive")  || document.querySelector('[data-action="gdrive"], [data-action="google-drive"]')
  };

  // ---------- utils ----------
  const setText = (el, v) => { if (el) el.textContent = v ?? "—"; };
  const fmtTime = (sec) => {
    if (!isFinite(sec)) return "—";
    const s = Math.floor(sec%60).toString().padStart(2,"0");
    const m = Math.floor((sec/60)%60).toString().padStart(2,"0");
    const h = Math.floor(sec/3600);
    return h ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  // -------- preview + metadata --------
  function showImage(url){
    if (!els.previewImg) return;
    if (els.previewVideo) { try{ els.previewVideo.pause?.(); }catch{} els.previewVideo.src = ""; els.previewVideo.hidden = true; }
    els.previewImg.hidden = false;
    els.previewImg.src = url;
    els.previewImg.onload = () => URL.revokeObjectURL(url);
    if (els.previewHint) els.previewHint.hidden = true;
  }

  function showVideo(url){
    if (!els.previewVideo) return;
    if (els.previewImg) { els.previewImg.src = ""; els.previewImg.hidden = true; }
    els.previewVideo.hidden = false;
    els.previewVideo.src = url;
    els.previewVideo.onloadedmetadata = () => {
      setText(els.metaResolution, `${els.previewVideo.videoWidth}×${els.previewVideo.videoHeight}`);
      setText(els.metaDuration, fmtTime(els.previewVideo.duration));
      URL.revokeObjectURL(url);
    };
    if (els.previewHint) els.previewHint.hidden = true;
  }

       // ---------- Storage UI ----------
  function addToStorageList(file){
    if (!els.storageList || !file) return;

    // Full-size item in the bottom Recent section
    const item = document.createElement("div");
    item.className = "storage__item";
    item.innerHTML = `
      <div class="storage__thumb"></div>
      <div class="storage__meta">
        <div class="storage__name">${file.name}</div>
        <div class="storage__tags">Recent</div>
      </div>
    `;
    els.storageList.prepend(item);

    // Lightweight entry in the compact Recent dropdown (max 20)
    const recentList = document.querySelector("#storageRecentList");
    if (recentList){
      const mini = document.createElement("div");
      mini.className = "storage-dropdown__item";
      mini.innerHTML = `
        <span class="storage-dropdown__item-name">${file.name}</span>
        <span class="storage-dropdown__item-meta">just now</span>
      `;
      recentList.prepend(mini);

      while (recentList.children.length > 20){
        recentList.removeChild(recentList.lastElementChild);
      }
    }

    pushRecentPreview(file);
  }

  function pushRecentPreview(file){
    if (!els.recentPreviewRow) return;

    // If placeholders exist, clear them before adding real thumbs
    const placeholders = els.recentPreviewRow.querySelectorAll(".plume-thumb--placeholder");
    placeholders.forEach((node) => node.remove());

    const thumb = document.createElement("div");
    thumb.className = "plume-thumb";
    thumb.title = file.name || "Recent item";

    els.recentPreviewRow.prepend(thumb);

    // Keep only the three most recent thumbnails
    while (els.recentPreviewRow.children.length > 3){
      els.recentPreviewRow.removeChild(els.recentPreviewRow.lastElementChild);
    }
  }

  // Ensure we always have 3 placeholders when there are no real previews
  function ensureRecentPlaceholders(){
    if (!els.recentPreviewRow) return;
    if (els.recentPreviewRow.children.length) return;

    for (let i = 0; i < 3; i++){
      const ph = document.createElement("div");
      ph.className = "plume-thumb plume-thumb--placeholder";
      els.recentPreviewRow.appendChild(ph);
    }
  }

   // ---------- Library "cytoskeleton" grid ----------
  function initLibraryView(){
    const grid      = document.getElementById("libraryGrid");
    const metaBody  = document.getElementById("libraryMetaBody");
    if (!grid || !metaBody) return;

    // Demo dataset — each item is an "organism" that can occupy a chamber
    const libraryItems = [
      { id: 1,  name: "Project folder",       type: "folder", target: "All destinations",   source: "Ameba",  aspect: "square"    },
      { id: 2,  name: "example-clip.mp4",     type: "video",  target: "YouTube",            source: "Upload", aspect: "landscape" },
      { id: 3,  name: "shorts-intro.mp4",     type: "video",  target: "YouTube Shorts",     source: "Upload", aspect: "portrait"  },
      { id: 4,  name: "edit-audio.wav",       type: "audio",  target: "Spotify / Reels",    source: "Upload", aspect: "landscape" },
      { id: 5,  name: "Favorites",            type: "folder", target: "Mixed",              source: "Ameba",  aspect: "square"    },
      { id: 6,  name: "Lo-fi reel.mp4",       type: "video",  target: "IG Reels",           source: "Upload", aspect: "portrait"  },
      { id: 7,  name: "Gameplay highlights",  type: "video",  target: "Twitch / clips",     source: "Upload", aspect: "landscape" },
      { id: 8,  name: "Podcast Ep.1",         type: "audio",  target: "Podcast feeds",      source: "Upload", aspect: "square"    },
      { id: 9,  name: "Thumbnail set",        type: "folder", target: "Multi",              source: "Ameba",  aspect: "square"    },
      { id:10,  name: "Ad hook v3.mp4",       type: "video",  target: "Paid ads",           source: "Upload", aspect: "landscape" },
      { id:11,  name: "Stream intro",         type: "video",  target: "YouTube / Twitch",   source: "Upload", aspect: "landscape" },
      { id:12,  name: "Extra B-roll",         type: "folder", target: "Library only",       source: "Upload", aspect: "square"    },
      { id:13,  name: "Sound effects",        type: "folder", target: "All projects",       source: "Ameba",  aspect: "square"    },
      { id:14,  name: "Loop ambience.wav",    type: "audio",  target: "Background beds",    source: "Upload", aspect: "square"    }
    ];

    const VISIBLE_SLOTS = 16; // 4 columns x 4 rows
    const MAX_PAGE      = Math.max(0, Math.ceil(libraryItems.length / VISIBLE_SLOTS) - 1);
    let currentPage     = 0;
    let activeId        = null;

    // Create glowing nodes at grid intersections (5x5 = 25 nodes for 4x4 grid)
    function createIntersectionNodes(){
      let nodesContainer = grid.querySelector(".library-grid__nodes");
      if (!nodesContainer){
        nodesContainer = document.createElement("div");
        nodesContainer.className = "library-grid__nodes";
        // Create 25 nodes for 5x5 intersections
        for (let i = 0; i < 25; i++){
          const node = document.createElement("div");
          node.className = "library-grid__node";
          nodesContainer.appendChild(node);
        }
        grid.appendChild(nodesContainer);
      }
    }

    function clearSidePanel(){
      metaBody.innerHTML = `<p class="muted small">Select a clip or folder to see metadata.</p>`;
    }

    function showMetaInSidePanel(item){
      metaBody.innerHTML = `
        <p><strong>${item.name}</strong></p>
        <p class="small">Type: ${item.type}</p>
        <p class="small">Destination: ${item.target}</p>
        <p class="small">Source: ${item.source}</p>
        <p class="small">Others like this: coming soon…</p>
      `;
    }

    function setActiveCell(cell, id, toggleBubble){
      activeId = id || null;

      const cells = grid.querySelectorAll(".library-cell");
      cells.forEach((node) => {
        node.classList.remove("library-cell--active", "library-cell--show-meta");
      });

      if (!cell || !id) return;
      if (cell.classList.contains("library-cell--empty")) return;

      cell.classList.add("library-cell--active");
      if (toggleBubble){
        cell.classList.add("library-cell--show-meta");
      }
    }

    function renderPage(){
      // Preserve the intersection nodes container
      const nodesContainer = grid.querySelector(".library-grid__nodes");
      grid.innerHTML = "";
      if (nodesContainer){
        grid.appendChild(nodesContainer);
      }

      const startIndex = currentPage * VISIBLE_SLOTS;

      for (let slot = 0; slot < VISIBLE_SLOTS; slot++){
        const itemIndex = startIndex + slot;
        const item      = libraryItems[itemIndex];
        const cell      = document.createElement("button");
        cell.type       = "button";
        cell.className  = "library-cell";

        if (!item){
          // True empty chamber — NO content, only grid lines visible around it
          cell.classList.add("library-cell--empty");
          grid.appendChild(cell);
          continue;
        }

        cell.classList.add("library-cell--filled");
        cell.dataset.id = String(item.id);

        const aspect = item.aspect || "square";

        const preview = document.createElement("div");
        preview.className = `library-cell__preview library-cell__preview--${aspect}`;

        const divider = document.createElement("div");
        divider.className = "library-cell__divider";

        const metaBubble = document.createElement("div");
        metaBubble.className = "library-cell__meta";
        metaBubble.innerHTML = `
          <div class="library-cell__meta-title">${item.name}</div>
          <div class="library-cell__meta-row">Meta: ${item.type}</div>
          <div class="library-cell__meta-row">To: ${item.target}</div>
          <div class="library-cell__meta-row">From: ${item.source}</div>
        `;

        // Corner node for filled cells
        const node = document.createElement("div");
        node.className = "library-cell__node";

        cell.appendChild(preview);
        cell.appendChild(divider);
        cell.appendChild(metaBubble);
        cell.appendChild(node);

        cell.addEventListener("click", (evt) => {
          const clickedDivider = evt.target === divider;

          if (!clickedDivider){
            // Chamber click: focus organism in side panel, no overlay toggle
            showMetaInSidePanel(item);
            setActiveCell(cell, item.id, false);
            return;
          }

          // Divider click: toggle overlay bubble + focus
          const isSameBubble = cell.classList.contains("library-cell--show-meta") && activeId === item.id;

          if (isSameBubble){
            setActiveCell(null, null, true);
            clearSidePanel();
          } else {
            setActiveCell(cell, item.id, true);
            showMetaInSidePanel(item);
          }
        });

        grid.appendChild(cell);
      }

      // If the previously active organism walked off-page, clear focus
      if (!libraryItems.some((it) => it.id === activeId &&
            it === libraryItems[startIndex + (libraryItems.slice(startIndex, startIndex + VISIBLE_SLOTS).findIndex(s => s && s.id === it.id))])){
        setActiveCell(null, null, true);
        clearSidePanel();
      }
    }

    // Scroll → page through organisms; cytoskeleton stays still
    grid.addEventListener("wheel", (evt) => {
      evt.preventDefault();

      if (evt.deltaY > 0 && currentPage < MAX_PAGE){
        currentPage++;
        renderPage();
      } else if (evt.deltaY < 0 && currentPage > 0){
        currentPage--;
        renderPage();
      }
    }, { passive: false });

    // Optional keyboard paging
    grid.addEventListener("keydown", (evt) => {
      if (evt.key === "ArrowDown" && currentPage < MAX_PAGE){
        currentPage++;
        renderPage();
      }
      if (evt.key === "ArrowUp" && currentPage > 0){
        currentPage--;
        renderPage();
      }
    });

    // Initialize intersection nodes and render
    createIntersectionNodes();
    clearSidePanel();
    renderPage();
  }


      // ---------- Storage plumes: sections, dropdowns, focus modes ----------
function initStoragePlumes(){
  const panelsRoot   = document.querySelector(".panels");
  const storagePanel = document.querySelector(".panel--storage");
  const plumeWraps   = Array.from(document.querySelectorAll(".storage-plume-wrap"));
  const plumes       = Array.from(document.querySelectorAll(".storage-plume"));
  const sections     = Array.from(document.querySelectorAll(".storage__section"));
  if (!plumes.length || !sections.length) return;

  let currentKey = "recent"; // which content section is visible
  let focusKey   = null;     // which plume is in "take over" mode: "recent" | "library" | null

  const applyState = () => {
    // ----- focus classes on the Storage card -----
    if (storagePanel){
      storagePanel.classList.remove(
        "storage--focus",
        "storage--focus-recent",
        "storage--focus-library",
        "storage--focus-queue",
        "storage--focus-shared"
      );
      if (focusKey){
        storagePanel.classList.add("storage--focus");
        storagePanel.classList.add(`storage--focus-${focusKey}`);
      }
    }

    // ----- active state on plume buttons -----
    plumes.forEach((btn) => {
      const section = btn.dataset.section || "recent";
      let isActive = false;

      if (section === "recent"){
        // Recent only gets the "clicked" look when in focus
        isActive = focusKey === "recent";
      } else if (section === "library"){
        // Library is active while its section is open
        isActive = currentKey === "library";
      } else {
        // Queue / Shared: active only when their section is open
        isActive = section === currentKey;
      }

      btn.classList.toggle("is-active", isActive);
    });

    // ----- dropdowns (Recent + Queue) -----
    plumeWraps.forEach((wrap) => {
      const btn     = wrap.querySelector(".storage-plume");
      if (!btn) return;
      const section = btn.dataset.section || "";
      const hasDrop = !!wrap.querySelector(".storage-dropdown");
      let open      = false;

      // Queue: dropdown open when Queue is selected, and we're not in any focus
      if (section === "queue" && currentKey === "queue" && hasDrop && !focusKey){
        open = true;
      }

      // Recent: dropdown only open when Recent is in focus
      if (section === "recent" && focusKey === "recent" && hasDrop){
        open = true;
      }

      wrap.classList.toggle("is-open", open);
    });

    // ----- bottom content sections -----
    sections.forEach((sec) => {
      const match = sec.classList.contains(`storage__section--${currentKey}`);
      sec.classList.toggle("is-visible", match);
    });

    // ----- Library engulf: expand Storage only when Library is in focus -----
    if (panelsRoot){
      const expand = focusKey === "library";
      panelsRoot.classList.toggle("panels--library-expanded", expand);
    }
  };

  // ----- click handling -----
  plumes.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.section || "recent";

      // RECENT: toggle focus on/off, keep Recent as visible section
      if (key === "recent"){
        focusKey   = (focusKey === "recent") ? null : "recent";
        currentKey = "recent";
        applyState();
        return;
      }

          // LIBRARY: toggle focus; leaving focus returns to Recent section
    if (key === "library"){
      const wasFocused = focusKey === "library";

      if (wasFocused){
        // Exit Library focus: go back to base Recent view
        focusKey   = null;
        currentKey = "recent";
      } else {
        // Enter Library focus: Library plume header + grid
        focusKey   = "library";
        currentKey = "library";
      }

      applyState();
      return;
    }


      // QUEUE / SHARED: exit any focus, switch sections normally
      focusKey   = null;
      currentKey = key;
      applyState();
    });
  });

  // ----- initial state -----
  currentKey = "recent";
  focusKey   = null;
  applyState();

  // Keep the conveyor full when empty
  if (typeof ensureRecentPlaceholders === "function"){
    ensureRecentPlaceholders();
  }
}


  // ---------- single intake ----------
  function handleFileDrop(fileList){
    const file = fileList && fileList[0];
    if (!file) return;

    try {
      if (typeof setBasicMetadataFromFile === "function") {
        setBasicMetadataFromFile(file);
      } else {
        setText(els.metaFilename, file.name || "—");
      }
    } catch {}

    const url = URL.createObjectURL(file);
    if (file.type?.startsWith("video")) showVideo(url);
    else showImage(url);

    addToStorageList(file);
    log("absorbed:", { name: file.name, type: file.type, size: file.size });
  }

  // ---------- upload init ----------
  function initUpload(){
    on(els.fileInput, "change", (e) => {
      const files = e.target.files;
      if (files && files.length) handleFileDrop(files);
    });

    if (!els.dropZone) return;

    const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };
    ["dragenter","dragover","dragleave","drop"].forEach((ev) => on(els.dropZone, ev, prevent));

    on(els.dropZone, "dragenter", () => els.dropZone.classList.add("is-hover"));
    on(els.dropZone, "dragleave", () => els.dropZone.classList.remove("is-hover"));
    on(els.dropZone, "drop", (e) => {
      els.dropZone.classList.remove("is-hover");
      const files = e.dataTransfer?.files;
      if (files && files.length) handleFileDrop(files);
    });
  }

  // ---------- import icons ----------
  function initImportIcons(){
    if (els.impDevice) {
      els.impDevice.addEventListener("click", () => {
        if (!els.fileInput) { warn("fileInput not found"); return; }
        els.fileInput.click();
      });
    }
    if (els.impDropbox) {
      els.impDropbox.addEventListener("click", () => {
        if (els.oldDropbox) els.oldDropbox.click();
        else log("Dropbox connect not wired yet");
      });
    }
    if (els.impDrive) {
      els.impDrive.addEventListener("click", () => {
        if (els.oldGDrive) els.oldGDrive.click();
        else log("Google Drive connect not wired yet");
      });
    }
    log("import icons ready", {
      deviceBtn: !!els.impDevice, fileInput: !!els.fileInput,
      dropboxBtn: !!els.impDropbox, legacyDropbox: !!els.oldDropbox,
      driveBtn: !!els.impDrive, legacyDrive: !!els.oldGDrive
    });
  }

  // ---------- paste-link convert (stub) ----------
  async function handleConvertFromLink(){
    if (!els.pasteLink) return;
    const url = (els.pasteLink.value || "").trim();
    if (!url) return;
    try {
      log("convert from link:", url);
      // TODO: POST to backend for fetch/convert, update progress
    } catch (e) { err("convert error:", e); }
  }
  function initConvert(){
    on(els.convertBtn, "click", handleConvertFromLink);
    on(els.pasteLink, "keydown", (e) => { if (e.key === "Enter") handleConvertFromLink(); });
  }

  // expose minimal init (call once from inline script)
    window.AmebaInit = function AmebaInit(){
    initUpload();
    initImportIcons();
    initConvert();
    initStoragePlumes();
    initLibraryView();
  };
})();


/* =========================================================
   DESTINATION HUB KERNEL (robust, idempotent, animation-safe)
   ========================================================= */
(function initDestinationHubKernel(){
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
    tiktok:    { resolution:"1080×1920", codec:"video/h264; mp4" },
    instagram: { resolution:"1080×1350", codec:"video/h264; mp4" },
    youtube:   { resolution:"1920×1080", codec:"video/h264; mp4" },
    reddit:    { resolution:"1920×1080", codec:"video/h264; mp4" }
  };
  const state = { activePlatform: null, media: { url:null, type:null }, lastEdits: Object.create(null) };

  const setText = (el, v) => { if (el) el.textContent = v ?? "—"; };
  const fmtTime = (sec) => {
    if (!isFinite(sec)) return "—";
    const s = Math.floor(sec%60).toString().padStart(2,"0");
    const m = Math.floor((sec/60)%60).toString().padStart(2,"0");
    const h = Math.floor(sec/3600);
    return h ? `${h}:${m}:${s}` : `${m}:${s}`;
  };
  const animOn  = (hub)=>{ if(!hub) return; hub.classList.add("is-switching"); hub.setAttribute("aria-busy","true"); };
  const animOff = (hub)=>{ if(!hub) return; hub.classList.remove("is-switching"); hub.removeAttribute("aria-busy"); };

  function setMedia(fileOrUrl){
    const hub = Q.hub(); if (!hub) return;
    const v = Q.previewVideo(), i = Q.previewImg(), hint = Q.previewHint();
    const revokeLater = (url)=>{ try{ URL.revokeObjectURL(url); }catch{} };

    let url = null, mime = "";
    if (typeof fileOrUrl === "string") url = fileOrUrl;
    else if (fileOrUrl && typeof fileOrUrl === "object") {
      url = URL.createObjectURL(fileOrUrl);
      mime = fileOrUrl.type || "";
      setText(Q.metaFilename(), fileOrUrl.name || "—");
    }
    if (!url) return;

    if ((mime && mime.startsWith("video")) || (!mime && /\.(mp4|mov|webm|mkv)$/i.test(url))) {
      if (i){ i.hidden = true; i.src = ""; }
      if (v){
        v.hidden = false;
        v.src = url;
        v.onloadedmetadata = () => {
          setText(Q.metaResolution(), `${v.videoWidth}×${v.videoHeight}`);
          setText(Q.metaDuration(), fmtTime(v.duration));
          revokeLater(url);
        };
      }
      state.media = { url, type: "video" };
    } else {
      if (v){ try{ v.pause?.(); }catch{} v.hidden = true; v.src = ""; }
      if (i){ i.hidden = false; i.src = url; i.onload = () => revokeLater(url); }
      state.media = { url, type: "image" };
    }
    if (hint) hint.hidden = true;
  }

  function activatePlatform(platform){
    const hub = Q.hub(); if (!hub) return;
    if (hub.getAttribute("aria-busy")==="true") return;

    animOn(hub);
    const p = platform && PRESETS[platform] ? platform : null;
    hub.dataset.platform = p || "";
    state.activePlatform = p;

    document.dispatchEvent(new CustomEvent("hub-platform-changed", { detail: { platform: p }, bubbles: true }));

    const preset = p ? PRESETS[p] : null;
    if (preset){
      setText(Q.metaResolution(), preset.resolution);
      setText(Q.metaCodec(),      preset.codec);
    }

    Q.satellites().forEach(btn => {
      const on = btn.dataset.platform === p;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", String(on));
    });
    const ret = Q.returnBtn(); if (ret) ret.hidden = !p;

    let doneCalled = false;
    const done = () => { if(doneCalled) return; doneCalled = true; animOff(hub); hub.removeEventListener("transitionend", done); };
    hub.addEventListener("transitionend", done, { once:false });
    setTimeout(done, 320);
  }
  function returnToHub(){ activatePlatform(null); }

  function bindEventsOnce(){
    Q.satellites().forEach(btn => {
      btn.addEventListener("click", () => activatePlatform(btn.dataset.platform));
      btn.addEventListener("dblclick", returnToHub);
    });
    Q.ghostButtons().forEach(btn => {
      btn.addEventListener("click", () => activatePlatform(btn.getAttribute("data-target")));
    });
    const ret = Q.returnBtn(); if (ret) ret.addEventListener("click", returnToHub);
    document.addEventListener("keydown", (e)=>{ if (e.key === "Escape") returnToHub(); });
  }

  window.Hub = Object.freeze({ __ready: true, state, setMedia, activatePlatform, returnToHub });
  bindEventsOnce();

  const urlP = new URLSearchParams(location.search).get("platform");
  if (urlP && PRESETS[urlP]) activatePlatform(urlP);
})();

/* =========================================================
   Satellite Layout Controller (slots, outside the hub, no clipping)
   ========================================================= */
(function SatelliteTransformController(){
  const hubEl = document.querySelector(".dest-panel");
  const rail = document.querySelector(".dest-sat-rail");
  const stack = rail?.querySelector(".dest-sat-stack");
  if (!hubEl || !rail || !stack) return;

  const sats = () => Array.from(stack.querySelectorAll(".satellite"));

  function centerOf(el){
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width/2 + window.scrollX, y: r.top + r.height/2 + window.scrollY, w: r.width, h: r.height };
  }

  let rafId = null;
  const pending = [];
  function scheduleTransform(node, tx, ty, opts = {}){
    pending.push({ node, tx, ty, opts });
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      for (const p of pending){
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

  const SAT_SLOTS_ENABLED = true;
  const SAT_SLOT_MAP = {
    base: [
      { id: "R1", side: "right",  t: 0.30, gutter: 82 },
      { id: "R2", side: "right",  t: 0.48, gutter: 82 },
      { id: "R3", side: "right",  t: 0.66, gutter: 82 },
      { id: "R4", side: "right",  t: 0.84, gutter: 82 },
    ],
    morph: [
      { id: "UR", corner: "ur", gutterX: 70, gutterY: 70 },
      { id: "T",  side: "top",    t: 0.50, gutter: 64 },
      { id: "B",  side: "bottom", t: 0.50, gutter: 64 },
      { id: "L",  side: "left",   t: 0.50, gutter: 76 },
    ],
    assign: {
      base:  ["R1","R2","R3","R4"],
      morph: ["UR","T","B","L"],
    },
    platforms: ["tiktok","instagram","youtube","reddit"]
  };

  function placeSatellitesBySlots(mode = "base") {
    if (!SAT_SLOTS_ENABLED) return;

    const hub = document.querySelector("#destHub") || document.querySelector(".dest-panel");
    const stackEl = document.querySelector(".dest-sat-rail .dest-sat-stack");
    if (!hub || !stackEl) return;

    const rect = hub.getBoundingClientRect();
    const slots = SAT_SLOT_MAP[mode];
    const order = SAT_SLOT_MAP.assign[mode];
    const plats = SAT_SLOT_MAP.platforms;

    const isNarrow = window.matchMedia("(max-width:1100px)").matches;
    stackEl.classList.toggle("is-absolute", !isNarrow);

    if (!isNarrow) {
      stackEl.style.height = `${window.innerHeight}px`;
      stackEl.style.width = `var(--sat-size)`;
      stackEl.style.top = `0px`;
      stackEl.style.left = `0px`;
    } else {
      stackEl.style.height = "";
      stackEl.style.width = "";
      stackEl.style.top = "";
      stackEl.style.left = "";
    }

    const satsEls = plats.map((p)=>
      stackEl.querySelector(`[data-platform="${p}"]`) ||
      stackEl.querySelector(`.sat--${p[0]+p[1]}`) ||
      stackEl.children[0]
    ).filter(Boolean);

    const stackRect = stackEl.getBoundingClientRect();
    const stackPageLeft = stackRect.left + window.scrollX;
    const stackPageTop  = stackRect.top + window.scrollY;

    requestAnimationFrame(() => {
      satsEls.forEach((el, i) => {
        const slotId = order[i];
        const slot = slots.find(s => s.id === slotId);
        if (!slot) return;

        let x = 0, y = 0;
        if (slot.corner === "ur") {
          x = rect.right + (slot.gutterX ?? 64);
          y = rect.top   - (slot.gutterY ?? 64);
        } else if (slot.side === "right") {
          x = rect.right + slot.gutter;
          y = rect.top + rect.height * slot.t;
        } else if (slot.side === "left") {
          x = rect.left - slot.gutter;
          y = rect.top + rect.height * slot.t;
        } else if (slot.side === "top") {
          x = rect.left + rect.width * slot.t;
          y = rect.top - slot.gutter;
        } else if (slot.side === "bottom") {
          x = rect.left + rect.width * slot.t;
          y = rect.bottom + slot.gutter;
        }

        const tx = Math.round(x + window.scrollX - stackPageLeft);
        const ty = Math.round(y + window.scrollY - stackPageTop);
        el.style.transform = `translate(${tx}px, ${ty}px)`;
      });
    });
  }

  (function initSatelliteSlots(){
    if (!SAT_SLOTS_ENABLED) return;
    const hub = document.querySelector("#destHub") || document.querySelector(".dest-panel");
    if (!hub) return;

    const ro = new ResizeObserver(() => {
      const active = document.body.getAttribute("data-active-platform");
      placeSatellitesBySlots(active ? "morph" : "base");
    });
    ro.observe(hub);

    placeSatellitesBySlots("base");

    document.addEventListener("hub-platform-changed", (e) => {
      const active = e.detail?.platform || document.body.getAttribute("data-active-platform");
      placeSatellitesBySlots(active ? "morph" : "base");
    });
  })();

  function hubTopLeftSlot(){
    const previewWrap = hubEl.querySelector(".preview-wrap");
    const slotRect = previewWrap ? previewWrap.getBoundingClientRect() : hubEl.getBoundingClientRect();
    return { clientX: slotRect.left + 18 + window.scrollX, clientY: slotRect.top + 18 + window.scrollY };
  }

  function computeAndAnimate(activeIndex){
    const list = sats();
    if (!list.length) return;

    list.forEach(s => {
      s.style.transition = "transform .36s cubic-bezier(.2,.9,.3,1), opacity .28s ease";
      s.style.willChange = "transform, opacity";
    });

    if (activeIndex === -1){
      list.forEach((s) => {
        scheduleTransform(s, 0, 0, { clsRem: "is-active", z: 0, opacity: 1 });
        s.classList.remove("is-parking");
      });
      return;
    }

    const active = list[activeIndex];
    const activeCenter = centerOf(active);
    const hubSlot = hubTopLeftSlot();
    const dxActive = hubSlot.clientX - activeCenter.x;
    const dyActive = hubSlot.clientY - activeCenter.y;
    scheduleTransform(active, dxActive, dyActive, { clsAdd: "is-active", clsRem: "is-parking", z: 80, opacity: 1 });

    const others = list.filter((_, i) => i !== activeIndex);
    others.sort((a,b) => {
      const ca = centerOf(a), cb = centerOf(b);
      const da = Math.hypot(ca.x - activeCenter.x, ca.y - activeCenter.y);
      const db = Math.hypot(cb.x - activeCenter.x, cb.y - activeCenter.y);
      return da - db;
    });

    const SPACING = (activeCenter.h * 1.25) || 72;
    for (let i = 0; i < others.length; i++){
      const s = others[i];
      const sign = (i % 2 === 0) ? -1 : 1;
      const level = Math.ceil((i + 1) / 2);
      const targetX = hubSlot.clientX - (activeCenter.w * 0.5) + (sign * 6);
      const targetY = hubSlot.clientY + (sign * SPACING * level);
      const center = centerOf(s);
      const dx = targetX - center.x;
      const dy = targetY - center.y;
      scheduleTransform(s, dx, dy, { clsAdd: "is-parking", clsRem: "is-active", z: 70, opacity: 0.98 });
    }
  }

  function indexOfSat(el){ return sats().indexOf(el); }

  function bind(){
    sats().forEach((s) => {
      s.addEventListener("click", () => {
        const currentActive = hubEl.dataset.platform || "";
        const targetPlatform = s.dataset.platform || "";
        const alreadyActive = currentActive === targetPlatform;
        hubEl.dataset.platform = alreadyActive ? "" : targetPlatform;
        const newIndex = alreadyActive ? -1 : indexOfSat(s);
        computeAndAnimate(newIndex);
        document.dispatchEvent(new CustomEvent("hub-platform-changed", { detail: { platform: alreadyActive ? null : targetPlatform } }));
      }, { passive: true });
    });
  }

  document.addEventListener("hub-platform-changed", (e) => {
    const p = e?.detail?.platform || null;
    const list = sats();
    if (!list.length) return;
    if (!p) { computeAndAnimate(-1); return; }
    const idx = list.findIndex(b => b.dataset.platform === p);
    computeAndAnimate(idx);
  });

  let resizeId = null;
  function relayout(){
    if (window.matchMedia("(max-width:1100px)").matches){
      sats().forEach(s => { s.style.transform = ""; s.style.zIndex = ""; s.classList.remove("is-active","is-parking"); });
      return;
    }
    const list = sats();
    const activePlatform = hubEl.dataset.platform || "";
    if (!activePlatform) { computeAndAnimate(-1); return; }
    const activeIdx = list.findIndex(b => b.dataset.platform === activePlatform);
    computeAndAnimate(activeIdx);
  }

  window.addEventListener("resize", () => {
    if (resizeId) cancelAnimationFrame(resizeId);
    resizeId = requestAnimationFrame(relayout);
  }, { passive: true });

  bind();
  setTimeout(() => {
    const p = hubEl.dataset.platform || "";
    if (p) document.dispatchEvent(new CustomEvent("hub-platform-changed", { detail: { platform: p } }));
    else computeAndAnimate(-1);
  }, 120);
})();

/* =========================================================
   SATELLITE DYNAMIC POSITIONING (JS-based slot system)
   ========================================================= */
(function SatelliteDynamicPositioning() {
  "use strict";

  const hubPanel = document.querySelector(".dest-panel");
  const panelDest = document.querySelector(".panel--dest");
  const satellites = Array.from(document.querySelectorAll(".panel--dest .satellite"));
  
  if (!hubPanel || !panelDest || satellites.length === 0) return;

  // Fixed slot percentages for 4 satellites
  const SLOT_PERCENTAGES = [0.25, 0.45, 0.65, 0.85];
  const DEBOUNCE_MS = 150;

  let resizeTimeout = null;
  let activeSatellite = null;
  const satelliteSlots = new Map(); // Store original slot positions

  /**
   * Calculate and set satellite positions based on hub height
   */
  function positionSatellites() {
    const hubRect = hubPanel.getBoundingClientRect();
    const panelRect = panelDest.getBoundingClientRect();
    
    // Calculate hub content height (accounting for header and padding)
    const hubTop = hubRect.top;
    const panelTop = panelRect.top;
    const offsetFromPanelTop = hubTop - panelTop;
    const hubHeight = hubRect.height;

    satellites.forEach((sat, index) => {
      const slotIndex = parseInt(sat.dataset.slotIndex || index, 10);
      const slotPercent = SLOT_PERCENTAGES[slotIndex] || SLOT_PERCENTAGES[0];
      
      // Calculate position in pixels relative to panel-dest
      const slotPosition = offsetFromPanelTop + (hubHeight * slotPercent);
      
      // Store the slot position for animations
      satelliteSlots.set(sat, slotPosition);
      
      // Apply position unless satellite is actively docked
      if (!sat.classList.contains('is-docked')) {
        sat.style.setProperty('--slot', `${slotPosition}px`);
      }
    });
  }

  /**
   * Debounced resize handler
   */
  function handleResize() {
    if (resizeTimeout) clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      positionSatellites();
    }, DEBOUNCE_MS);
  }

  /**
   * Handle satellite click for docking/undocking
   */
  function handleSatelliteClick(event) {
    const satellite = event.currentTarget;
    const platform = satellite.dataset.platform;
    
    if (satellite.classList.contains('is-docked')) {
      // Return to slot
      undockSatellite(satellite);
    } else {
      // Dock satellite
      dockSatellite(satellite, platform);
    }
  }

  /**
   * Dock a satellite (move to dock area)
   */
  function dockSatellite(satellite, platform) {
    // Undock any currently docked satellite first
    if (activeSatellite && activeSatellite !== satellite) {
      undockSatellite(activeSatellite);
    }

    satellite.classList.add('is-docked', 'is-active');
    activeSatellite = satellite;
    
    // Trigger platform change event
    document.dispatchEvent(new CustomEvent('hub-platform-changed', {
      detail: { platform },
      bubbles: true
    }));
  }

  /**
   * Undock a satellite (return to slot)
   */
  function undockSatellite(satellite) {
    const originalSlot = satelliteSlots.get(satellite);
    if (originalSlot !== undefined) {
      satellite.style.setProperty('--slot', `${originalSlot}px`);
    }
    
    satellite.classList.remove('is-docked', 'is-active');
    if (activeSatellite === satellite) {
      activeSatellite = null;
    }
    
    // Trigger platform clear event
    document.dispatchEvent(new CustomEvent('hub-platform-changed', {
      detail: { platform: null },
      bubbles: true
    }));
  }

  /**
   * Initialize positioning and event listeners
   */
  function init() {
    // Initial positioning
    positionSatellites();

    // Set up resize observer for hub changes
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(hubPanel);
    
    // Also observe panel-dest for size changes
    resizeObserver.observe(panelDest);

    // Window resize for orientation changes
    window.addEventListener('resize', handleResize, { passive: true });

    // Satellite click handlers
    satellites.forEach(sat => {
      sat.addEventListener('click', handleSatelliteClick);
    });

    console.log('[satellite-positioning] Initialized with', satellites.length, 'satellites');
  }

  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();











































