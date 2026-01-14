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

   // ---------- Library vertical list ----------
function initLibraryView(){
  const list         = document.getElementById("libraryList");
  const detailsPanel = document.getElementById("libraryDetailsPanel");
  const detailsBody  = document.getElementById("libraryDetailsBody");
  const closeBtn     = document.getElementById("libraryDetailsClose");
  if (!list || !detailsPanel || !detailsBody) return;

  // "Settings" hook (wired for future UI; can be toggled via localStorage in dev)
  const SETTINGS = {
    // 1 = show details panel immediately (matches current beta screenshots)
    detailsOpenByDefault: (localStorage.getItem("ameba.library.detailsOpenByDefault") ?? "1") !== "0",
    // 1 = keep the special "Project folder" row
    includeProjectFolderRow: (localStorage.getItem("ameba.library.includeProjectFolderRow") ?? "1") !== "0"
  };

  // Demo dataset — library items with platform and metadata
  const PROJECT_FOLDER_ITEM = {
    id: 1,
    name: "Project folder",
    type: "folder",
    platform: "youtube",
    duration: "—",
    date: "Dec 20",
    tags: ["folder", "youtube"]
  };

  const LIBRARY_ITEMS_BASE = [
    { id: 2,  name: "example-clip.mp4",     type: "video",  platform: "youtube",   duration: "3:42",  date: "Dec 22", tags: ["shorts", "viral"] },
    { id: 3,  name: "shorts-intro.mp4",     type: "video",  platform: "tiktok",    duration: "0:15",  date: "Dec 23", tags: ["intro", "short"] },
    { id: 4,  name: "edit-audio.wav",       type: "audio",  platform: "instagram", duration: "2:18",  date: "Dec 21", tags: ["reels", "music"] },
    { id: 5,  name: "Favorites",            type: "folder", platform: "reddit",    duration: "—",     date: "Dec 18", tags: ["collection"] },
    { id: 6,  name: "Lo-fi reel.mp4",       type: "video",  platform: "instagram", duration: "0:30",  date: "Dec 24", tags: ["lofi", "chill"] },
    { id: 7,  name: "Gameplay highlights",  type: "video",  platform: "youtube",   duration: "12:45", date: "Dec 19", tags: ["gaming", "highlights"] },
    { id: 8,  name: "Podcast Ep.1",         type: "audio",  platform: "youtube",   duration: "45:00", date: "Dec 15", tags: ["podcast", "audio"] },
    { id: 9,  name: "Thumbnail set",        type: "folder", platform: "youtube",   duration: "—",     date: "Dec 17", tags: ["thumbnails"] },
    { id:10,  name: "Ad hook v3.mp4",       type: "video",  platform: "tiktok",    duration: "0:06",  date: "Dec 25", tags: ["ad", "hook"] },
    { id:11,  name: "Stream intro",         type: "video",  platform: "reddit",    duration: "0:08",  date: "Dec 16", tags: ["stream", "intro"] },
    { id:12,  name: "Extra B-roll",         type: "folder", platform: "instagram", duration: "—",     date: "Dec 14", tags: ["broll"] }
  ];

  // Project folder row separated (easy to remove later)
  const libraryItems = [
    ...(SETTINGS.includeProjectFolderRow ? [PROJECT_FOLDER_ITEM] : []),
    ...LIBRARY_ITEMS_BASE
  ];

  let selectedId = null;

  function renderSlots(){
    list.innerHTML = "";

    // Create all slots (CSS limits viewport to 5 visible; the list scrolls for the rest)
    libraryItems.forEach((item) => {
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = "library-slot";
      slot.dataset.id = String(item.id);
      slot.dataset.platform = item.platform;

      // Banner background
      const banner = document.createElement("div");
      banner.className = "library-slot__banner";

      // Morph layer (platform-colored translucent layer behind preview)
      const morph = document.createElement("div");
      morph.className = "library-slot__morph";

      // Floating 1:1 preview square
      const preview = document.createElement("div");
      preview.className = "library-slot__preview";

      // Content metadata
      const content = document.createElement("div");
      content.className = "library-slot__content";

      const title = document.createElement("div");
      title.className = "library-slot__title";
      title.textContent = item.name;

      const meta = document.createElement("div");
      meta.className = "library-slot__meta";

      // Platform badge
      const badge = document.createElement("span");
      badge.className = "library-slot__badge";
      badge.textContent = item.platform;

      // Tags
      const tagsContainer = document.createElement("span");
      item.tags.slice(0, 2).forEach(tag => {
        const tagEl = document.createElement("span");
        tagEl.className = "library-slot__tag";
        tagEl.textContent = tag;
        tagsContainer.appendChild(tagEl);
      });

      meta.appendChild(badge);
      meta.appendChild(tagsContainer);

      // Info row (duration, date)
      const info = document.createElement("div");
      info.className = "library-slot__info";
      info.innerHTML = `
        <span>⏱ ${item.duration}</span>
        <span>📅 ${item.date}</span>
      `;

      content.appendChild(title);
      content.appendChild(meta);
      content.appendChild(info);

      // Assemble slot (layering: banner < morph < preview, content)
      slot.appendChild(banner);
      slot.appendChild(morph);
      slot.appendChild(preview);
      slot.appendChild(content);

      slot.addEventListener("click", () => {
        selectSlot(item.id);
      });

      list.appendChild(slot);
    });

    // Fill to 5 visible with empties when dataset is short
    const emptyCount = Math.max(0, 5 - libraryItems.length);
    for (let i = 0; i < emptyCount; i++){
      const emptySlot = document.createElement("div");
      emptySlot.className = "library-slot library-slot--empty";
      emptySlot.innerHTML = `
        <div class="library-slot__banner"></div>
        <div class="library-slot__content">
          <div class="library-slot__title">Empty slot</div>
          <div class="library-slot__info">
            <span class="muted small">Drag files here or convert new media</span>
          </div>
        </div>
      `;
      list.appendChild(emptySlot);
    }
  }

  function selectSlot(id){
    selectedId = id;

    // Update selected state
    const slots = list.querySelectorAll(".library-slot");
    slots.forEach(slot => {
      if (slot.dataset.id === String(id)) slot.classList.add("library-slot--selected");
      else slot.classList.remove("library-slot--selected");
    });

    const item = libraryItems.find(it => it.id === id);
    if (item) showDetailsPanel(item);
  }

  function showDetailsPanel(item){
    detailsBody.innerHTML = `
      <h3 style="margin: 0 0 16px 0; font-size: 16px;">${item.name}</h3>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div style="padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px;">
          <div style="font-size: 11px; color: rgba(255,255,255,0.6); margin-bottom: 4px;">Type</div>
          <div style="font-size: 13px;">${item.type}</div>
        </div>
        <div style="padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px;">
          <div style="font-size: 11px; color: rgba(255,255,255,0.6); margin-bottom: 4px;">Platform</div>
          <div style="font-size: 13px; text-transform: capitalize;">${item.platform}</div>
        </div>
        <div style="padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px;">
          <div style="font-size: 11px; color: rgba(255,255,255,0.6); margin-bottom: 4px;">Duration</div>
          <div style="font-size: 13px;">${item.duration}</div>
        </div>
        <div style="padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px;">
          <div style="font-size: 11px; color: rgba(255,255,255,0.6); margin-bottom: 4px;">Date Added</div>
          <div style="font-size: 13px;">${item.date}</div>
        </div>
        <div style="padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px;">
          <div style="font-size: 11px; color: rgba(255,255,255,0.6); margin-bottom: 4px;">Tags</div>
          <div style="font-size: 13px;">${item.tags.join(", ")}</div>
        </div>
      </div>
    `;
    detailsPanel.classList.add("library-details-panel--visible");
    detailsPanel.setAttribute("aria-hidden","false");
  }

  function hideDetailsPanel(){
    detailsPanel.classList.remove("library-details-panel--visible");
    detailsPanel.setAttribute("aria-hidden","true");
    selectedId = null;

    // Deselect all slots
    const slots = list.querySelectorAll(".library-slot");
    slots.forEach(slot => slot.classList.remove("library-slot--selected"));
  }

  if (closeBtn){
    closeBtn.addEventListener("click", hideDetailsPanel);
  }

  renderSlots();

  // Default: keep Details open (can be toggled later in Settings)
  if (SETTINGS.detailsOpenByDefault && libraryItems.length){
    selectSlot(libraryItems[0].id);
  } else {
    hideDetailsPanel();
  }
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

// ---------- WORKSHOP (Phase 1 + 2) ----------
function initWorkshop(){
  const root = document.getElementById("workshopRoot");
  if (!root) return;

  const awarenessLane = document.getElementById("awarenessLane");
  const laneToggle    = document.getElementById("laneToggle");
  const laneIcon      = document.getElementById("laneIcon");
  const laneUnreadBadge = document.getElementById("laneUnreadBadge");
  const laneGroups   = document.getElementById("laneGroups");
  const laneStatus   = document.getElementById("laneStatus");
  const inkPool      = document.getElementById("inkPool");
  const inkMenu      = document.getElementById("inkMenu");
  const inkSearch    = document.getElementById("inkSearch");
  const inkItems     = document.getElementById("inkItems");

  const deskStage    = document.getElementById("deskStage");
  const newNoteBtn   = document.getElementById("newNoteBtn");
  const newReminderBtn = document.getElementById("newReminderBtn");

  const queueDrop    = document.getElementById("queueDrop");
  const queueList    = document.getElementById("queueList");

  const queueCountEl = document.getElementById("queueCount");
  const noteCountEl  = document.getElementById("noteCount");
  const unreadCountEl= document.getElementById("unreadCount");

  // ---- state (local, simple) ----
  const LS_NOTES   = "ameba.workshop.notes.v1";
  const LS_ARTIFACTS = "ameba.workshop.artifacts.v1";

  const state = {
    events: [],        // awareness events
    unread: 0,
    notes: loadJSON(LS_NOTES, []),
    artifacts: loadJSON(LS_ARTIFACTS, []),
    queue: []          // staged media
  };

  function loadJSON(key, fallback){
    try { return JSON.parse(localStorage.getItem(key) || "") ?? fallback; }
    catch { return fallback; }
  }
  function saveNotes(){ localStorage.setItem(LS_NOTES, JSON.stringify(state.notes)); }
  function saveJournal(v){ localStorage.setItem(LS_JOURNAL, v || ""); }

  // ---- Awareness: event model ----
  function pushEvent(ev){
    state.events.unshift(ev);
    state.unread += 1;
    renderLane();
    renderCounts();
    // mark “new” highlight for a moment
    setTimeout(() => {
      const node = document.querySelector(`[data-ev-id="${ev.id}"]`);
      node?.classList.remove("is-new");
    }, 1200);
  }

  function groupedByPlatform(){
    const groups = {};
    for (const ev of state.events.slice(0, 25)){
      const p = ev.platform || "other";
      if (!groups[p]) groups[p] = [];
      groups[p].push(ev);
    }
    return groups;
  }

  function renderLane(){
    if (!laneGroups) return;

    const groups = groupedByPlatform();
    const platforms = Object.keys(groups);
    laneGroups.innerHTML = "";

    if (!platforms.length){
      laneGroups.innerHTML = `<div class="muted small" style="padding:8px;">No movement yet.</div>`;
      if (laneStatus) laneStatus.textContent = "quiet";
      return;
    }

    if (laneStatus) laneStatus.textContent = "monitoring";

    for (const platform of platforms){
      const list = groups[platform];
      const wrap = document.createElement("div");
      wrap.className = "lane__group";
      wrap.innerHTML = `
        <div class="group__row">
          <div class="group__name">${platform}</div>
          <div class="group__badge">${list.length}</div>
        </div>
        <div class="group__items">
          ${list.slice(0,3).map(ev => `
            <div class="lane__item is-new" data-ev-id="${ev.id}">
              ${escapeHTML(ev.text)}
            </div>
          `).join("")}
        </div>
      `;
      laneGroups.appendChild(wrap);
    }
  }

  function renderCounts(){
    if (queueCountEl) queueCountEl.textContent = String(state.queue.length);
    if (noteCountEl)  noteCountEl.textContent  = String(state.artifacts.length);
    if (unreadCountEl)unreadCountEl.textContent= String(state.unread);
    
    // Update badge on collapsed icon
    if (laneUnreadBadge) {
      if (state.unread > 0) {
        laneUnreadBadge.textContent = String(state.unread);
        laneUnreadBadge.hidden = false;
      } else {
        laneUnreadBadge.hidden = true;
      }
    }
  }

  // ---- Awareness Lane: Collapse/Expand ----
  function toggleLane(){
    if (!awarenessLane) return;
    const isCollapsed = awarenessLane.classList.toggle("is-collapsed");
    if (laneToggle) laneToggle.textContent = isCollapsed ? "Expand" : "Collapse";
    
    // Mark unread as read when expanding
    if (!isCollapsed) {
      state.unread = 0;
      renderCounts();
    }
  }

  if (laneToggle) {
    laneToggle.addEventListener("click", toggleLane);
  }

  if (laneIcon) {
    laneIcon.addEventListener("click", toggleLane);
  }

  // Enhance pushEvent with pulse animation
  const originalPushEvent = pushEvent;
  function pushEvent(ev){
    originalPushEvent(ev);
    
    // Add pulse to icon when collapsed
    if (awarenessLane && awarenessLane.classList.contains("is-collapsed") && laneIcon) {
      laneIcon.classList.add("is-pulsing");
      setTimeout(() => laneIcon.classList.remove("is-pulsing"), 2000);
    }
  }

  // ---- Ink commands (Canvas router) ----
  const commands = [
    { key: "idea", label: "I have an idea", run: () => createNote("Idea", "") },
    { key: "post", label: "I wanna post", run: () => openDestinationHub() },
    { key: "edit", label: "Need to edit", run: () => openTool("dripl-engine") },
    { key: "note", label: "New note slip", run: () => createNote("Note", "") },
  ];

  function renderInkMenu(filter=""){
    if (!inkItems) return;
    const f = filter.trim().toLowerCase();
    const items = !f ? commands : commands.filter(c => c.label.toLowerCase().includes(f));
    inkItems.innerHTML = items.map(c => `
      <div class="inkmenu__item" data-cmd="${c.key}">
        ${escapeHTML(c.label)}
      </div>
    `).join("");

    inkItems.querySelectorAll(".inkmenu__item").forEach(el => {
      el.addEventListener("click", () => {
        const cmd = el.getAttribute("data-cmd");
        const found = commands.find(c => c.key === cmd);
        found?.run();
        closeInk();
      });
    });
  }

  function openInk(){
    if (!inkMenu) return;
    inkMenu.hidden = false;
    renderInkMenu("");
    inkSearch?.focus();
  }
  function closeInk(){
    if (!inkMenu) return;
    inkMenu.hidden = true;
    inkSearch && (inkSearch.value = "");
  }

  // Cmd+K (or /) opens Ink
  document.addEventListener("keydown", (e) => {
    const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
    const isSlash = e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey;
    if (isCmdK || isSlash){
      e.preventDefault();
      openInk();
    }
    if (e.key === "Escape" && inkMenu && !inkMenu.hidden){
      e.preventDefault();
      closeInk();
    }
  });

  // ---- Desk: notes + journal ----
  function createNote(title, body){
    const id = crypto?.randomUUID?.() || String(Date.now() + Math.random());
    state.notes.unshift({ id, title, body, createdAt: Date.now() });
    saveNotes();
    renderNotes();
    renderCounts();
  }

  function renderNotes(){
    if (!noteList) return;
    noteList.innerHTML = state.notes.slice(0, 12).map(n => `
      <div class="note" data-note-id="${n.id}">
        <div class="note__title">${escapeHTML(n.title)}</div>
        <div class="note__body">${escapeHTML(n.body || "…")}</div>
      </div>
    `).join("");
  }

  on(newNoteBtn, "click", () => createNote("Note", "Write here…"));
  on(pinBtn, "click", () => {
    // MVP: pin just creates a “Canvas pinned” note
    createNote("Pinned to Canvas", "A slip surfaced.");
  });

  on(journalInput, "input", () => {
    state.journal = journalInput.value || "";
    saveJournal(state.journal);
  });

  // Desk tabs switching
  document.querySelectorAll(".desk__tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".desk__tab").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");

      const tab = btn.getAttribute("data-tab");
      document.querySelectorAll(".desk__view").forEach(v => v.classList.remove("is-visible"));
      document.querySelector(`.desk__view[data-view="${tab}"]`)?.classList.add("is-visible");
    });
  });

  // ---- Desk Stage: artifact placement ----
  function createArtifact(type, title, body){
    const id = crypto?.randomUUID?.() || String(Date.now() + Math.random());
    state.artifacts.push({ id, type, title, body, createdAt: Date.now() });
    saveArtifacts();
    renderDeskStage();
    renderCounts();
  }

  function deleteArtifact(id){
    state.artifacts = state.artifacts.filter(a => a.id !== id);
    saveArtifacts();
    renderDeskStage();
    renderCounts();
  }

  function renderDeskStage(){
    if (!deskStage) return;
    
    // Keep hint, remove old artifacts
    const hint = deskStage.querySelector(".desk__stage-hint");
    deskStage.innerHTML = "";
    if (hint) deskStage.appendChild(hint);
    
    // Render artifacts
    state.artifacts.forEach(artifact => {
      const el = document.createElement("div");
      el.className = "desk__artifact";
      el.dataset.artifactId = artifact.id;
      el.innerHTML = `
        <button class="desk__artifact-delete" data-delete-id="${artifact.id}" title="Delete">×</button>
        <div style="font-weight:600; font-size:12px; margin-bottom:4px;">${escapeHTML(artifact.title)}</div>
        <div style="font-size:12px; opacity:.85;">${escapeHTML(artifact.body || "")}</div>
        <div style="font-size:10px; opacity:.6; margin-top:6px;">${artifact.type}</div>
      `;
      
      // Delete button
      const deleteBtn = el.querySelector(".desk__artifact-delete");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const id = deleteBtn.getAttribute("data-delete-id");
          if (id) deleteArtifact(id);
        });
      }
      
      deskStage.appendChild(el);
    });
  }

  // Update button handlers to use artifacts
  if (newNoteBtn) {
    newNoteBtn.addEventListener("click", () => {
      const title = prompt("Note title:", "Quick Note");
      if (title) {
        const body = prompt("Note body:", "Write something...");
        createArtifact("note", title, body || "");
      }
    });
  }

  if (newReminderBtn) {
    newReminderBtn.addEventListener("click", () => {
      const title = prompt("Reminder:", "Remember to...");
      if (title) {
        createArtifact("reminder", title, "");
      }
    });
  }

  // ---- Queue dock: drag drop ----
  function addToQueue(file){
    state.queue.unshift({
      id: crypto?.randomUUID?.() || String(Date.now() + Math.random()),
      name: file.name,
      type: file.type,
      size: file.size,
      addedAt: Date.now()
    });
    renderQueue();
    renderCounts();
  }

  function renderQueue(){
    if (!queueList) return;
    queueList.innerHTML = state.queue.slice(0, 8).map(q => `
      <div class="queuecard">
        <div class="queuecard__name">${escapeHTML(q.name)}</div>
        <div class="queuecard__meta">${escapeHTML(q.type || "file")} • ${(q.size/1024/1024).toFixed(1)}mb</div>
      </div>
    `).join("");
  }

  function wireDrop(el){
    if (!el) return;
    const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };
    ["dragenter","dragover","dragleave","drop"].forEach(ev => el.addEventListener(ev, prevent));
    el.addEventListener("drop", (e) => {
      const files = e.dataTransfer?.files;
      if (files && files.length) addToQueue(files[0]);
    });
  }
  wireDrop(queueDrop);

  // ---- Routing actions (MVP stubs) ----
  function openDestinationHub(){
    // MVP: scroll to top wall / hub and visually indicate it
    document.getElementById("topWall")?.scrollIntoView({ behavior:"smooth", block:"start" });
    pushEvent({
      id: "hub-" + Date.now(),
      platform: "ameba",
      text: "Ink opened the Hub.",
      createdAt: Date.now()
    });
  }
  function openTool(toolKey){
    // MVP: uses your existing tool shed button if present
    const shed = document.getElementById("toolShed");
    shed && (shed.hidden = false);
    pushEvent({
      id: "tool-" + Date.now(),
      platform: "tools",
      text: `Ink surfaced a tool: ${toolKey}.`,
      createdAt: Date.now()
    });
  }

  on(openHubBtn, "click", openDestinationHub);
  on(inkPool, "click", () => {
    if (inkMenu && !inkMenu.hidden) closeInk();
    else openInk();
  });
  on(inkSearch, "input", () => renderInkMenu(inkSearch.value || ""));

  // ---- Awareness mock generator (replace later with API) ----
  const mockPlatforms = ["youtube", "tiktok", "spotify"];
  const mockLines = {
    youtube: ["New comment arrived.", "A like landed.", "Subscriber count stirred."],
    tiktok:  ["A heart blinked.", "Someone followed.", "A comment splashed in."],
    spotify: ["A save was added.", "A playlist ripple.", "A listener returned."]
  };

  function startMockAwareness(){
    // only if there’s no real events yet
    setInterval(() => {
      const p = mockPlatforms[Math.floor(Math.random()*mockPlatforms.length)];
      const line = mockLines[p][Math.floor(Math.random()*mockLines[p].length)];
      pushEvent({
        id: p + "-" + Date.now(),
        platform: p,
        text: line,
        createdAt: Date.now()
      });
    }, 12000);
  }

  // ---- utilities ----
  function escapeHTML(s){
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  // initial renders
  renderLane();
  renderDeskStage();
  renderQueue();
  renderCounts();
  renderInkMenu("");
  startMockAwareness();
}


  // expose minimal init (call once from inline script)
    window.AmebaInit = function AmebaInit(){
    initUpload();
    initImportIcons();
    initConvert();
    initStoragePlumes();
    initLibraryView();
    initWorkshop();
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


/* ==========================================================================
   OPEN SPACE SHELL INTERACTIONS
   ========================================================================== */

(function OpenSpaceShell() {
  "use strict";
  
  const $ = (sel) => document.querySelector(sel);
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);
  
  // -------------------------
  // Workshop View (render)
  // -------------------------
  const WS = {
    deskKey: "ameba:desk:v1",
    lastPulseAt: 0,
    blobLastSpokeAt: 0
  };

  function renderWorkshop(){
    if (!openSpaceContent) return;

    openSpaceContent.innerHTML = `
  <div class="workshop-grid" id="workshopGrid">

    <!-- Awareness Lane -->
    <section class="ws-card awareness-lane ws-area-awareness" id="awarenessLane" aria-label="Awareness lane">
      <div class="ws-card__head">
        <h3 class="ws-card__title">Awareness</h3>
        <span class="muted" style="font-size:11px;" id="awarenessMode">monitoring</span>
      </div>
      <div class="ws-card__body">
        <div class="awareness-stream" id="awarenessStream"></div>
      </div>
    </section>

    <!-- Canvas -->
    <section class="ws-card ink-canvas ws-area-canvas" aria-label="Canvas">
      <div class="ws-card__head">
        <h3 class="ws-card__title">Canvas</h3>
        <span class="muted" style="font-size:11px;">clean ink</span>
      </div>

      <div class="ws-card__body">
        <div class="muted" style="font-size:12px;">
          Read-only clarity. Pull what you need. The canvas stays simple.
        </div>

        <div class="canvas-actions" style="margin-top:12px;">
          <button class="canvas-btn" id="wsIdeaBtn">I have an idea</button>
          <button class="canvas-btn" id="wsPostBtn">I wanna post</button>
          <button class="canvas-btn" id="wsEditBtn">Need to edit</button>
          <button class="canvas-btn" id="wsNoteBtn">New note slip</button>
        </div>

        <!-- slips spawn here before being placed -->
        <div style="margin-top:14px;" id="wsSlipBin"></div>

        <!-- optional: simple “read-only calendar” stub -->
        <div class="ws-card" style="margin-top:14px; border-radius:14px;">
          <div class="ws-card__head" style="padding:10px 12px;">
            <h3 class="ws-card__title">Read-only calendar</h3>
            <span class="muted" style="font-size:11px;">stub</span>
          </div>
          <div class="ws-card__body" style="padding:12px;">
            <div class="muted" style="font-size:12px;">
              Upcoming: (placeholder) • Later we’ll show scheduled posts + reminders.
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Stats tile (top-right) -->
    <section class="ws-card ws-area-stats" aria-label="Workshop stats">
      <div class="ws-card__head">
        <h3 class="ws-card__title">Stats</h3>
        <span class="muted" style="font-size:11px;">combined</span>
      </div>
      <div class="ws-card__body">
        <div class="ws-mini-stats">
          <div class="ws-stat">
            <div class="ws-stat__k">Followers</div>
            <div class="ws-stat__v" id="wsFollowers">—</div>
          </div>
          <div class="ws-stat">
            <div class="ws-stat__k">Likes</div>
            <div class="ws-stat__v" id="wsLikes">—</div>
          </div>
        </div>
        <div class="muted" style="font-size:11px; margin-top:10px;">
          (Later: YouTube subs + TikTok followers + etc.)
        </div>
      </div>
    </section>

    <!-- Desk Stage (right tall) -->
    <section class="ws-card desk-stage ws-area-desk" aria-label="Desk stage">
      <div class="ws-card__head">
        <h3 class="ws-card__title">Desk</h3>
        <span class="muted" style="font-size:11px;">place artifacts</span>
      </div>
      <div class="ws-card__body">
        <div class="desk-stage__hint">
          Drag slips here. They stay until trashed.
        </div>
        <div class="desk-dropzone" id="deskDropzone" aria-label="Desk drop zone"></div>
        <div class="muted" style="font-size:11px; margin-top:10px;">
          Tip: right-click a note to delete (desktop). Mobile later gets a long-press menu.
        </div>
      </div>
    </section>

  </div>
`;

    initWorkshopUX();
  }

  // -------------------------
  // Workshop UX (notes + awareness + blob)
  // -------------------------
  function initWorkshopUX(){
    // Guard: only bind once per render
    const slipBin = $("#wsSlipBin");
    const desk = $("#deskDropzone");
    const awarenessStream = $("#awarenessStream");
    const awarenessLane = $("#awarenessLane");

    if (!slipBin || !desk || !awarenessStream || !awarenessLane) return;

    // Load persisted desk notes
    loadDeskNotes(desk);

    // Canvas buttons
    on($("#wsNoteBtn"), "click", () => {
      const n = makeSlip({ text: "New thought…", tag: "note" });
      slipBin.prepend(n);
    });

    on($("#wsIdeaBtn"), "click", () => {
      const n = makeSlip({ text: "Idea: ", tag: "idea" });
      slipBin.prepend(n);
    });

    on($("#wsPostBtn"), "click", () => {
  // no hub — create a “post plan” slip users can place on desk
  const n = makeSlip({ text: "Post plan: platform / caption / time…", tag: "post" });
  slipBin.prepend(n);
  document.dispatchEvent(new CustomEvent("awareness:event", {
    detail: { platform: "AMEBA", type: "canvas", text: "Post plan slip created." }
  }));
});

on($("#wsEditBtn"), "click", () => {
  const n = makeSlip({ text: "Edit note: trim / hook / subtitles…", tag: "edit" });
  slipBin.prepend(n);
  document.dispatchEvent(new CustomEvent("awareness:event", {
    detail: { platform: "AMEBA", type: "canvas", text: "Edit slip created." }
  }));
});

    // Desk dropzone drag events
    desk.addEventListener("dragover", (e) => { e.preventDefault(); desk.classList.add("is-over"); });
    desk.addEventListener("dragleave", () => desk.classList.remove("is-over"));
    desk.addEventListener("drop", (e) => {
      e.preventDefault();
      desk.classList.remove("is-over");

      const id = e.dataTransfer.getData("text/ameba-slip-id");
      if (!id) return;

      const slip = document.querySelector(`[data-slip-id="${CSS.escape(id)}"]`);
      if (!slip) return;

      // Convert slip -> placed desk note
      const rect = desk.getBoundingClientRect();
      const x = Math.max(8, e.clientX - rect.left - 80);
      const y = Math.max(8, e.clientY - rect.top - 20);

      const placed = placeDeskNoteFromSlip(slip, { x, y });
      desk.appendChild(placed);

      // Remove slip from bin after placing
      slip.remove();

      saveDeskNotes(desk);
      pushAwareness({ platform: "Desk", type: "placed", text: "Artifact placed on desk." });

      document.dispatchEvent(new CustomEvent("desk:note-added", { detail: { id: placed.dataset.noteId }}));
    });

    // Seed awareness with a few items (mock)
    if (!awarenessStream.dataset.seeded) {
      awarenessStream.dataset.seeded = "1";
      pushAwareness({ platform: "YouTube", type: "comment", text: "New comment arrived." });
      pushAwareness({ platform: "TikTok", type: "like", text: "Someone liked your post." });
      pushAwareness({ platform: "Spotify", type: "save", text: "A song was added to liked songs." });
    }

    // Listen for awareness events (centralized)
    document.addEventListener("awareness:event", (ev) => {
      const item = renderAwarenessItem(ev.detail);
      awarenessStream.prepend(item);

      // Pulse lane (rate limited)
      const now = Date.now();
      if (now - WS.lastPulseAt > 600) {
        WS.lastPulseAt = now;
        awarenessLane.classList.add("is-pulsing");
        setTimeout(() => awarenessLane.classList.remove("is-pulsing"), 550);
      }

      // Blob reacts (rare)
      blobObserve(ev.detail);
    });

    // Also let hub platform changes feed awareness
    document.addEventListener("hub-platform-changed", (ev) => {
      const p = ev.detail?.platform;
      if (!p) return;
      pushAwareness({ platform: "Hub", type: "platform", text: `Platform preset selected: ${p}` });
    });

    // Right click delete desk notes (desktop only)
    desk.addEventListener("contextmenu", (e) => {
      const note = e.target.closest(".note-slip");
      if (!note || !desk.contains(note)) return;
      e.preventDefault();
      note.remove();
      saveDeskNotes(desk);
      pushAwareness({ platform: "Desk", type: "deleted", text: "Artifact trashed." });
      document.dispatchEvent(new CustomEvent("desk:note-deleted", { detail: { id: note.dataset.noteId }}));
    });

    function pushAwareness(detail){
      document.dispatchEvent(new CustomEvent("awareness:event", { detail }));
    }

    function renderAwarenessItem({ platform, type, text }){
      const el = document.createElement("div");
      el.className = "awareness-item";
      el.innerHTML = `
        <div style="display:flex; justify-content:space-between; gap:10px;">
          <strong>${escapeHtml(platform || "AMEBA")}</strong>
          <span class="muted">${escapeHtml(type || "event")}</span>
        </div>
        <div style="margin-top:6px;">${escapeHtml(text || "")}</div>
      `;
      return el;
    }
  }

  // -------------------------
  // Note creation / persistence
  // -------------------------
  function makeSlip({ text, tag }){
    const id = `slip_${Math.random().toString(16).slice(2)}_${Date.now()}`;
    const el = document.createElement("div");
    el.className = "note-slip";
    el.setAttribute("draggable", "true");
    el.dataset.slipId = id;

    el.innerHTML = `
      <div class="note-slip__meta">${escapeHtml(tag || "note")}</div>
      <div class="note-slip__text" contenteditable="true" spellcheck="false">${escapeHtml(text || "")}</div>
    `;

    el.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/ameba-slip-id", id);
      e.dataTransfer.effectAllowed = "move";
    });

    return el;
  }

  function placeDeskNoteFromSlip(slip, { x, y }){
    const noteId = `desk_${Math.random().toString(16).slice(2)}_${Date.now()}`;
    const textEl = slip.querySelector(".note-slip__text");
    const metaEl = slip.querySelector(".note-slip__meta");

    const el = document.createElement("div");
    el.className = "note-slip";
    el.dataset.noteId = noteId;
    el.style.position = "absolute";
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    el.innerHTML = `
      <div class="note-slip__meta">${escapeHtml(metaEl?.textContent || "note")}</div>
      <div class="note-slip__text" contenteditable="true" spellcheck="false">${escapeHtml(textEl?.textContent || "")}</div>
    `;

    // Make placed notes draggable inside desk (simple pointer move)
    let dragging = false, ox = 0, oy = 0;
    el.addEventListener("pointerdown", (e) => {
      dragging = true;
      ox = e.clientX - el.getBoundingClientRect().left;
      oy = e.clientY - el.getBoundingClientRect().top;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const parent = el.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const nx = Math.max(6, e.clientX - rect.left - ox);
      const ny = Math.max(6, e.clientY - rect.top - oy);
      el.style.left = `${nx}px`;
      el.style.top = `${ny}px`;
    });
    el.addEventListener("pointerup", () => {
      dragging = false;
      const parent = el.parentElement;
      if (parent) saveDeskNotes(parent);
      document.dispatchEvent(new CustomEvent("desk:note-moved", { detail: { id: noteId }}));
    });

    return el;
  }

  function saveDeskNotes(deskEl){
    const notes = Array.from(deskEl.querySelectorAll(".note-slip")).map(n => {
      const text = n.querySelector(".note-slip__text")?.textContent || "";
      const tag = n.querySelector(".note-slip__meta")?.textContent || "note";
      return {
        id: n.dataset.noteId || "",
        x: parseFloat(n.style.left) || 10,
        y: parseFloat(n.style.top) || 10,
        text,
        tag
      };
    });
    try{
      localStorage.setItem(WS.deskKey, JSON.stringify(notes));
    }catch(e){}
  }

  function loadDeskNotes(deskEl){
    let raw = null;
    try{ raw = localStorage.getItem(WS.deskKey); }catch(e){}
    if (!raw) return;
    let notes = [];
    try{ notes = JSON.parse(raw) || []; }catch(e){ notes = []; }
    notes.forEach(n => {
      const slip = makeSlip({ text: n.text, tag: n.tag });
      // convert to desk note
      const placed = placeDeskNoteFromSlip(slip, { x: n.x, y: n.y });
      placed.dataset.noteId = n.id || placed.dataset.noteId;
      deskEl.appendChild(placed);
    });
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  // -------------------------
  // Blob (observer v1)
  // -------------------------
  function blobObserve(detail){
    const now = Date.now();

    // Rare speech: at most once every ~20s
    if (now - WS.blobLastSpokeAt < 20000) return;

    // Only speak on certain event types
    const t = detail?.type || "";
    const shouldSpeak = (t === "comment" || t === "like" || t === "platform");
    if (!shouldSpeak) return;

    WS.blobLastSpokeAt = now;

    const riddles = [
      "a ripple in the glass… someone touched your work.",
      "numbers move. meaning follows later.",
      "a voice arrived. do you answer, or do you watch?",
      "your orbit changed. same star, new angle."
    ];
    const line = riddles[Math.floor(Math.random() * riddles.length)];

    // Update toolbar status as Blob “mood”
    const status = document.getElementById("toolbarStatus");
    if (status) status.textContent = "blob noticed";

    // Also emit as awareness (but marked as Blob)
    document.dispatchEvent(new CustomEvent("awareness:event", {
      detail: { platform: "Blob", type: "riddle", text: line }
    }));

    setTimeout(() => { if (status) status.textContent = "monitoring"; }, 2400);
  }

  // Elements
  const vanityBubble = $("#vanityBubble");
  const vanityAvatar = $(".vanity-bubble__avatar");
  const toolShed = $("#toolShed");
  const openSpaceContent = $("#openSpaceContent");
  const analyticsWall = $("#analyticsWall");
  const analyticsToggle = $("#analyticsToggle");
  
  // Dock buttons
  const dockUpload = $("#dockUpload");
  const dockImport = $("#dockImport");
  const dockConvert = $("#dockConvert");
  const dockStorage = $("#dockStorage");
  
  // State
  let toolShedOpen = false;
  let analyticsOpen = true;
  
  // Vanity Bubble / Tool Shed Toggle
  function toggleToolShed() {
    toolShedOpen = !toolShedOpen;
    
    if (toolShedOpen) {
      toolShed.hidden = false;
      vanityBubble.classList.add("tool-shed-active");
      // Show tool selection in open space
      showToolSelection();
    } else {
      toolShed.hidden = true;
      vanityBubble.classList.remove("tool-shed-active");
      // Show default user stats
      showDefaultStats();
    }
  }
  
  function showToolSelection() {
    if (!openSpaceContent) return;
    openSpaceContent.innerHTML = `
      <div class="tool-selection-view">
        <h2 style="color: var(--text); font-size: 28px; margin-bottom: 24px; text-align: center;">
          Select a Tool
        </h2>
        <div style="display: flex; gap: 24px; justify-content: center; flex-wrap: wrap;">
          <div class="tool-card" data-tool="dripl-engine">
            <div style="font-size: 48px; margin-bottom: 16px;">⚙️</div>
            <div style="font-size: 18px; font-weight: 600; color: var(--text);">Dripl Engine</div>
            <div style="font-size: 13px; color: var(--muted); margin-top: 8px;">
              Advanced media processing
            </div>
          </div>
          <div class="tool-card" data-tool="ameba-quality">
            <div style="font-size: 48px; margin-bottom: 16px;">✨</div>
            <div style="font-size: 18px; font-weight: 600; color: var(--text);">AMEBA Quality+</div>
            <div style="font-size: 13px; color: var(--muted); margin-top: 8px;">
              AI quality enhancement
            </div>
          </div>
          <div class="tool-card" data-tool="batch-process">
            <div style="font-size: 48px; margin-bottom: 16px;">📦</div>
            <div style="font-size: 18px; font-weight: 600; color: var(--text);">Batch Process</div>
            <div style="font-size: 13px; color: var(--muted); margin-top: 8px;">
              Process multiple files
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Add click handlers to tool cards
    const toolCards = openSpaceContent.querySelectorAll('.tool-card');
    toolCards.forEach(card => {
      on(card, "click", (e) => {
        const tool = card.dataset.tool;
        showToolInterface(tool);
      });
    });
  }
  
  function showDefaultStats() {
    if (!openSpaceContent) return;
    openSpaceContent.innerHTML = `
      <div class="user-stats-placeholder">
        <div class="stat-widget">
          <span class="stat-label">Followers</span>
          <span class="stat-value">—</span>
        </div>
        <div class="stat-widget">
          <span class="stat-label">Likes</span>
          <span class="stat-value">—</span>
        </div>
        <div class="stat-widget">
          <span class="stat-label">Emails</span>
          <span class="stat-value">—</span>
        </div>
      </div>
    `;
  }
  
  // Analytics Wall Toggle
  function toggleAnalyticsWall() {
    analyticsOpen = !analyticsOpen;
    
    if (analyticsOpen) {
      analyticsWall.classList.remove("collapsed");
    } else {
      analyticsWall.classList.add("collapsed");
    }
  }
  
  // Dock button handlers (bridge to existing functionality)
  function handleDockUpload() {
    // Trigger file input click
    const fileInput = $("#fileInput");
    if (fileInput) fileInput.click();
  }
  
  function handleDockImport() {
    // Show import options (could open a modal or panel)
    console.log("[OpenSpace] Import clicked - TODO: wire to existing import logic");
    // TODO: Replace with proper UI - show import modal or panel
  }
  
  function handleDockConvert() {
    // Trigger conversion
    const convertBtn = $("#convert-btn");
    if (convertBtn) convertBtn.click();
  }
  
  function handleDockStorage() {
    // Toggle storage view (could show storage panel in open space)
    console.log("[OpenSpace] Storage clicked - TODO: wire to existing storage");
    // TODO: Replace with proper UI - show storage in open space
  }
  
  // Show tool interface (shared function)
  function showToolInterface(tool) {
    console.log("[OpenSpace] Tool selected:", tool);
    
    // Close tool shed
    toolShedOpen = false;
    toolShed.hidden = true;
    
    // Show tool-specific UI in open space
    if (openSpaceContent) {
      openSpaceContent.innerHTML = `
        <div style="text-align: center; padding: 60px;">
          <h2 style="color: var(--text); font-size: 32px; margin-bottom: 16px;">
            ${tool.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
          </h2>
          <p style="color: var(--muted); font-size: 16px;">
            Tool interface placeholder - to be implemented
          </p>
          <button 
            id="backToTools" 
            class="btn btn--primary" 
            style="margin-top: 32px; padding: 12px 24px; background: rgba(139, 92, 246, 0.2); border: 1px solid rgba(139, 92, 246, 0.4); border-radius: 8px; cursor: pointer; color: var(--text);"
          >
            Back to Tools
          </button>
        </div>
      `;
      
      // Wire back button
      const backBtn = $("#backToTools");
      on(backBtn, "click", () => {
        toolShedOpen = true;
        toolShed.hidden = false;
        showToolSelection();
      });
    }
  }
  
  // Tool item click handler (from tool shed)
  function handleToolItemClick(e) {
    const toolItem = e.target.closest(".tool-item");
    if (!toolItem) return;
    
    const tool = toolItem.dataset.tool;
    showToolInterface(tool);
  }
  
  // Event listeners
  on(vanityBubble, "click", toggleToolShed);
  on(analyticsToggle, "click", toggleAnalyticsWall);
  on(dockUpload, "click", handleDockUpload);
  on(dockImport, "click", handleDockImport);
  on(dockConvert, "click", handleDockConvert);
  on(dockStorage, "click", handleDockStorage);
  
  // Delegate tool item clicks
  on(toolShed, "click", handleToolItemClick);
  
  // Initialize: set default state
  if (analyticsWall) {
    analyticsWall.classList.add("collapsed");
    analyticsOpen = false;
  }
  
  console.log("[OpenSpace] Shell initialized");
})();











































