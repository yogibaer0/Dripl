/* ==========================================================================
   AMEBA Supply Module — Campaign-aware Asset Browser
   ========================================================================== */

(function SupplyModule() {
  "use strict";

  /* ---------- Store shorthand -------------------------------------------- */
  function store() {
    return window.AMEBA && window.AMEBA.storage && window.AMEBA.storage.campaign;
  }

  /* ---------- Helpers ----------------------------------------------------- */
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  /* ---------- Derive data from campaign store ----------------------------- */
  function getRecentAssets() {
    if (!store()) return [];
    var campaign = store().getCampaign();
    if (!campaign) return [];
    return campaign.assets.files.map(function(f) {
      return {
        id:       f.id,
        name:     f.name,
        type:     f.type,
        size:     f.size,
        campaign: campaign.name,
        date:     f.date
      };
    });
  }

  /* ---------- Placeholder upload: adds a demo asset to the store --------- */
  function handleUploadClick(rerender, container) {
    if (!store()) return;
    var demo = {
      id:     "demo-" + Date.now(),
      name:   "upload-demo-" + Date.now() + ".mp4",
      type:   "Raw",
      size:   "—",
      date:   "Just now",
      linked: false
    };
    store().updateCampaign(function(campaign) {
      campaign.assets.files.unshift(demo);
      return campaign;
    });
    rerender(container);
  }

  /* ---------- Render ------------------------------------------------------ */
  function render(container) {
    container.innerHTML = "";

    var RECENT = getRecentAssets();
    var LINKED = store() ? store().getLinkedAssets() : [];

    var shell = el("div", "supply-shell");

    // Header
    var header = el("div", "supply-header");
    header.innerHTML =
      "<h1 class=\"supply-header__title\">Supply</h1>" +
      "<p class=\"supply-header__subtitle\">Campaign-aware asset browser. Uploads, linked files, and recent assets — ready for storage integration.</p>";
    shell.appendChild(header);

    // Upload zone (placeholder)
    var uploadZone = el("div", "supply-upload");
    uploadZone.innerHTML =
      "<div class=\"supply-upload__icon\">" +
        "<svg viewBox=\"0 0 32 32\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\">" +
          "<path d=\"M16 22V10M10 16l6-6 6 6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>" +
          "<rect x=\"4\" y=\"4\" width=\"24\" height=\"24\" rx=\"4\" stroke-width=\"1\" opacity=\"0.3\"/>" +
        "</svg>" +
      "</div>" +
      "<div class=\"supply-upload__label\">Drop files here or click to upload</div>" +
      "<div class=\"supply-upload__hint\">Any format · Automatically linked to the active campaign</div>" +
      "<button class=\"supply-upload__btn\">Choose Files</button>";
    // Wire upload button: placeholder behavior — adds a demo asset and re-renders
    var uploadBtn = uploadZone.querySelector(".supply-upload__btn");
    if (uploadBtn) {
      uploadBtn.addEventListener("click", function() {
        handleUploadClick(render, container);
      });
    }
    shell.appendChild(uploadZone);

    // Two-column grid: recent + linked
    var grid = el("div", "supply-grid");

    // Recent assets section
    var recentSection = el("div", "supply-section");
    recentSection.innerHTML =
      "<h2 class=\"supply-section__title\">Recent Assets <span class=\"supply-section__count\">" + RECENT.length + "</span></h2>";
    var recentList = el("ul", "supply-list");
    RECENT.forEach(function(r) {
      var li = el("li", "supply-item");
      li.innerHTML =
        "<div class=\"supply-item__type\">" + r.type + "</div>" +
        "<div class=\"supply-item__info\">" +
          "<div class=\"supply-item__name\">" + r.name + "</div>" +
          "<div class=\"supply-item__meta\">" + r.campaign + " · " + r.size + " · " + r.date + "</div>" +
        "</div>";
      recentList.appendChild(li);
    });
    recentSection.appendChild(recentList);
    grid.appendChild(recentSection);

    // Linked to campaign section
    var linkedSection = el("div", "supply-section");
    linkedSection.innerHTML =
      "<h2 class=\"supply-section__title\">Linked to Campaign <span class=\"supply-section__count\">" + LINKED.length + "</span></h2>";
    var linkedList = el("ul", "supply-list");
    LINKED.forEach(function(l) {
      var li = el("li", "supply-item");
      li.innerHTML =
        "<div class=\"supply-item__type supply-item__type--linked\">Link</div>" +
        "<div class=\"supply-item__info\">" +
          "<div class=\"supply-item__name\">" + l.name + "</div>" +
          "<div class=\"supply-item__meta\">" + l.campaign + " · " + l.deliverable + "</div>" +
        "</div>";
      linkedList.appendChild(li);
    });
    linkedSection.appendChild(linkedList);
    grid.appendChild(linkedSection);

    shell.appendChild(grid);

    // Future storage integration placeholder
    var future = el("div", "supply-future");
    future.innerHTML =
      "<div class=\"supply-future__icon\">" +
        "<svg viewBox=\"0 0 20 20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\">" +
          "<rect x=\"2\" y=\"5\" width=\"16\" height=\"12\" rx=\"2\"/>" +
          "<path d=\"M6 5V3a4 4 0 0 1 8 0v2\" stroke-linecap=\"round\"/>" +
          "<circle cx=\"10\" cy=\"11\" r=\"2\" fill=\"currentColor\" opacity=\"0.6\" stroke=\"none\"/>" +
        "</svg>" +
      "</div>" +
      "<div class=\"supply-future__label\">Storage Integration Coming</div>" +
      "<p class=\"supply-future__hint\">Full cloud storage (Dropbox, Drive, S3) and campaign-aware file management will connect here in a future pass.</p>";
    shell.appendChild(future);

    container.appendChild(shell);
  }

  window.SupplyModule = { render: render };

}());
