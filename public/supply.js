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
    var campaign = store().getActiveCampaign();
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

  /**
   * Return a map of assetId → array of deliverable titles that reference it.
   */
  function getAssetDeliverableMap() {
    if (!store()) return {};
    var deliverables = store().getDeliverables();
    var map = {};
    deliverables.forEach(function(d) {
      (d.assetIds || []).forEach(function(aid) {
        if (!map[aid]) map[aid] = [];
        map[aid].push({ id: d.id, title: d.title });
      });
    });
    return map;
  }

  /* ---------- Placeholder upload: adds a demo asset to the store --------- */
  function handleUploadClick(rerender, container) {
    if (!store()) return;
    var demo = {
      id:   "demo-" + Date.now(),
      name: "upload-demo-" + Date.now() + ".mp4",
      type: "Raw",
      size: "\u2014",
      date: "Just now"
    };
    store().updateActiveCampaign(function(campaign) {
      campaign.assets.files.unshift(demo);
      return campaign;
    });
    rerender(container);
  }

  /* ---------- Render ------------------------------------------------------ */
  var ARROW = " \u25be";

  function render(container) {
    container.innerHTML = "";

    var RECENT      = getRecentAssets();
    var LINKED      = store() ? store().getLinkedAssets() : [];
    var deliverables = store() ? store().getDeliverables() : [];
    var adMap       = getAssetDeliverableMap();   // assetId → [{id, title}]

    var shell = el("div", "supply-shell");

    // Header
    var header = el("div", "supply-header");
    var activeCampaign = store() ? store().getActiveCampaign() : null;
    var activeCampaignName = activeCampaign ? activeCampaign.name : "";
    header.innerHTML =
      "<h1 class=\"supply-header__title\">Supply</h1>" +
      "<p class=\"supply-header__subtitle\">Campaign-aware asset browser. Uploads, linked files, and recent assets \u2014 ready for storage integration." +
      (activeCampaignName ? " <span class=\"supply-header__campaign\">" + activeCampaignName + "</span>" : "") +
      "</p>";
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
    var uploadBtn = uploadZone.querySelector(".supply-upload__btn");
    if (uploadBtn) {
      uploadBtn.addEventListener("click", function() {
        handleUploadClick(render, container);
      });
    }
    shell.appendChild(uploadZone);

    // Two-column grid: recent + linked
    var grid = el("div", "supply-grid");

    // ── Recent assets section ─────────────────────────────────────────────
    var recentSection = el("div", "supply-section");
    recentSection.innerHTML =
      "<h2 class=\"supply-section__title\">Recent Assets <span class=\"supply-section__count\">" + RECENT.length + "</span></h2>";

    var recentList = el("ul", "supply-list");
    RECENT.forEach(function(r) {
      var assetLinks = adMap[r.id] || [];   // deliverables this asset is in

      var li = el("li", "supply-item");

      // Type badge
      var typeBadge = el("div", "supply-item__type", r.type);

      // Info column
      var info = el("div", "supply-item__info");
      var nameEl = el("div", "supply-item__name", r.name);
      var metaEl = el("div", "supply-item__meta", r.campaign + " \u00b7 " + r.size + " \u00b7 " + r.date);
      info.appendChild(nameEl);
      info.appendChild(metaEl);

      // Linked deliverable badges (existing links) + derive linked state from assetIds map
      var isLinked = assetLinks.length > 0;
      if (assetLinks.length) {
        var badgeRow = el("div", "supply-item__link-badges");
        assetLinks.forEach(function(dl) {
          var badge = el("span", "supply-item__link-badge", dl.title);
          badgeRow.appendChild(badge);
        });
        info.appendChild(badgeRow);
      }

      // Inline link control
      var linkCtrl = el("div", "supply-item__link-ctrl");

      var linkToggle = el("button", "supply-link-toggle", (isLinked ? "Linked" : "Link") + ARROW);
      if (isLinked) linkToggle.classList.add("supply-link-toggle--linked");

      var linkPanel = el("div", "supply-link-panel supply-link-panel--hidden");

      // Build options: deliverables not yet containing this asset
      var alreadyLinkedIds = assetLinks.map(function(dl) { return dl.id; });
      var available = deliverables.filter(function(d) {
        return alreadyLinkedIds.indexOf(d.id) === -1;
      });

      if (available.length) {
        var sel = document.createElement("select");
        sel.className = "supply-link-select";
        var phOpt = document.createElement("option");
        phOpt.value = "";
        phOpt.textContent = "Choose deliverable\u2026";
        sel.appendChild(phOpt);
        available.forEach(function(d) {
          var opt = document.createElement("option");
          opt.value = d.id;
          opt.textContent = d.title;
          sel.appendChild(opt);
        });

        var confirmBtn = el("button", "supply-link-confirm", "Link");
        confirmBtn.addEventListener("click", function() {
          var selId = sel.value;
          if (!selId || !store()) return;
          store().linkAssetToDeliverable(r.id, selId);
          render(container);
        });

        linkPanel.appendChild(sel);
        linkPanel.appendChild(confirmBtn);
      } else {
        linkPanel.innerHTML = "<span class=\"supply-link-panel__all-linked\">Linked to all deliverables</span>";
      }

      linkToggle.addEventListener("click", function() {
        var hidden = linkPanel.classList.contains("supply-link-panel--hidden");
        linkPanel.classList.toggle("supply-link-panel--hidden", !hidden);
      });

      linkCtrl.appendChild(linkToggle);
      linkCtrl.appendChild(linkPanel);

      li.appendChild(typeBadge);
      li.appendChild(info);
      li.appendChild(linkCtrl);
      recentList.appendChild(li);
    });

    recentSection.appendChild(recentList);
    grid.appendChild(recentSection);

    // ── Linked to campaign section ────────────────────────────────────────
    var linkedSection = el("div", "supply-section");
    linkedSection.innerHTML =
      "<h2 class=\"supply-section__title\">Linked to Campaign <span class=\"supply-section__count\">" + LINKED.length + "</span></h2>";
    var linkedList = el("ul", "supply-list");
    LINKED.forEach(function(l) {
      var li = el("li", "supply-item");
      var badge = el("div", "supply-item__type supply-item__type--linked", l.type || "Link");
      var info  = el("div", "supply-item__info");
      info.innerHTML =
        "<div class=\"supply-item__name\">" + l.name + "</div>" +
        "<div class=\"supply-item__meta\">" + l.campaign + " \u00b7 " + (l.deliverables ? l.deliverables.join(", ") : l.deliverable) + "</div>";
      li.appendChild(badge);
      li.appendChild(info);
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
