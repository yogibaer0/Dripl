/* ==========================================================================
   AMEBA Supply Module — Campaign-aware Asset Browser Placeholder
   ========================================================================== */

(function SupplyModule() {
  "use strict";

  /* ---------- Mock Data --------------------------------------------------- */
  var RECENT = [
    { id: "r1", name: "hero-shot-final.mp4",      type: "Video",  size: "2.3 GB",  campaign: "Summer Drop 2025",    date: "Mar 15" },
    { id: "r2", name: "brand-kit-2025.zip",        type: "Bundle", size: "145 MB",  campaign: "Summer Drop 2025",    date: "Mar 10" },
    { id: "r3", name: "raw-footage-day1.mov",      type: "Video",  size: "8.1 GB",  campaign: "Summer Drop 2025",    date: "Mar 12" },
    { id: "r4", name: "influencer-brief-v2.pdf",   type: "Doc",    size: "3.8 MB",  campaign: "Influencer Collab #4",date: "Mar 8"  },
    { id: "r5", name: "brand-reset-deck.pptx",     type: "Slide",  size: "12 MB",   campaign: "Brand Reset Q3",      date: "Mar 5"  }
  ];

  var LINKED = [
    { id: "l1", name: "thumbnail-set-v2.psd",    campaign: "Summer Drop 2025", deliverable: "Hero Reel — Launch Day"    },
    { id: "l2", name: "campaign-brief.pdf",       campaign: "Summer Drop 2025", deliverable: "All deliverables"          },
    { id: "l3", name: "brand-kit-2025.zip",       campaign: "Summer Drop 2025", deliverable: "All deliverables"          },
    { id: "l4", name: "product-close-edit.mp4",   campaign: "Summer Drop 2025", deliverable: "Product Close-up Teaser"   }
  ];

  /* ---------- Helpers ----------------------------------------------------- */
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  /* ---------- Render ------------------------------------------------------ */
  function render(container) {
    container.innerHTML = "";

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
