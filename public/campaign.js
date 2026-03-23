/* ==========================================================================
   AMEBA Campaign Module — Workspace, Sub-pages & Deliverable Focus
   ========================================================================== */

(function CampaignModule() {
  "use strict";

  /* ---------- State ------------------------------------------------------- */
  var state = {
    section: "overview", // overview | production | strategy | assets | delivery
    focus:   null        // deliverable id or null
  };

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

  function statusColor(status) {
    var map = {
      "Draft":         "#6060a0",
      "In Production": "#f59e0b",
      "In Review":     "#a78bfa",
      "Approved":      "#4ade80",
      "Ready":         "#4ade80"
    };
    return map[status] || "#8888aa";
  }

  function statusBg(status) {
    var map = {
      "Draft":         "rgba(96,96,160,0.12)",
      "In Production": "rgba(245,158,11,0.12)",
      "In Review":     "rgba(167,139,250,0.12)",
      "Approved":      "rgba(74,222,128,0.12)",
      "Ready":         "rgba(74,222,128,0.12)"
    };
    return map[status] || "rgba(136,136,170,0.12)";
  }

  function assetTypeColor(type) {
    var map = {
      "Raw":       "#f59e0b",
      "Edit":      "#a78bfa",
      "Thumbnail": "#34d399",
      "Brand":     "#f87171",
      "Document":  "#60a5fa"
    };
    return map[type] || "#8888aa";
  }

  /* ---------- Internal Navigation ---------------------------------------- */
  var _container = null;

  function _navigate(section, focusId) {
    state.section = section;
    state.focus   = focusId || null;
    if (_container) _draw(_container);
  }

  /* ---------- Draw -------------------------------------------------------- */
  function _draw(container) {
    _container = container;
    container.innerHTML = "";

    var CAMPAIGN = store() && store().getActiveCampaign();
    if (!CAMPAIGN) {
      container.innerHTML = '<p style="color:#6060a0;padding:24px">Campaign data unavailable.</p>';
      return;
    }

    var shell = el("div", "camp-shell");

    // Header (always shown)
    shell.appendChild(_renderHeader(CAMPAIGN));

    // Sub-nav (hidden when in deliverable focus)
    if (!state.focus) {
      shell.appendChild(_renderSubNav());
    }

    // Main content area
    var content = el("div", "camp-content");
    if (state.focus) {
      _renderDeliverableFocus(content, state.focus, CAMPAIGN);
    } else {
      switch (state.section) {
        case "overview":   _renderOverview(content, CAMPAIGN);   break;
        case "production": _renderProduction(content, CAMPAIGN); break;
        case "strategy":   _renderStrategy(content, CAMPAIGN);   break;
        case "assets":     _renderAssets(content, CAMPAIGN);     break;
        case "delivery":   _renderDelivery(content, CAMPAIGN);   break;
        default:           _renderOverview(content, CAMPAIGN);
      }
    }
    shell.appendChild(content);
    container.appendChild(shell);
  }

  /* ---------- Header ------------------------------------------------------ */
  function _renderHeader(CAMPAIGN) {
    var h = el("div", "camp-header");
    var breadcrumb = el("div", "camp-breadcrumb");

    if (state.focus) {
      var deliverables = CAMPAIGN.production.deliverables;
      var focusItem = null;
      for (var i = 0; i < deliverables.length; i++) {
        if (deliverables[i].id === state.focus) { focusItem = deliverables[i]; break; }
      }
      breadcrumb.innerHTML =
        '<button class="camp-breadcrumb__link" id="campBcCampaign">Campaign</button>' +
        '<span class="camp-breadcrumb__sep">\u203a</span>' +
        '<button class="camp-breadcrumb__link" id="campBcProduction">Production</button>' +
        '<span class="camp-breadcrumb__sep">\u203a</span>' +
        '<span class="camp-breadcrumb__current">' + (focusItem ? focusItem.title : "Deliverable") + '</span>';
    } else if (state.section === "overview") {
      breadcrumb.innerHTML = '<span class="camp-breadcrumb__current">Campaign</span>';
    } else {
      var label = state.section.charAt(0).toUpperCase() + state.section.slice(1);
      breadcrumb.innerHTML =
        '<button class="camp-breadcrumb__link" id="campBcCampaign">Campaign</button>' +
        '<span class="camp-breadcrumb__sep">\u203a</span>' +
        '<span class="camp-breadcrumb__current">' + label + '</span>';
    }
    h.appendChild(breadcrumb);

    // Main row: campaign info on left, switcher on right
    var mainRow = el("div", "camp-header__row");

    var info = el("div", "camp-header__info");
    info.innerHTML =
      '<h1 class="camp-header__name">' + CAMPAIGN.name + '</h1>' +
      '<div class="camp-header__meta">' +
        '<span class="camp-header__client">' + CAMPAIGN.client + '</span>' +
        '<span class="camp-header__dot">\u00b7</span>' +
        '<span class="camp-header__type">' + CAMPAIGN.type + '</span>' +
        '<span class="camp-header__dot">\u00b7</span>' +
        '<span class="camp-header__duration">' + CAMPAIGN.duration + '</span>' +
      '</div>';
    mainRow.appendChild(info);

    // Campaign switcher — only shown when multiple campaigns exist
    var campaigns = store() ? store().getCampaigns() : [];
    if (campaigns && campaigns.length > 1) {
      var switcher = el("div", "camp-switcher");
      var switchLbl = el("div", "camp-switcher__label", "Campaign");
      var switchSel = el("select", "camp-switcher__select");
      campaigns.forEach(function(c) {
        var opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name;
        if (c.id === CAMPAIGN.id) opt.selected = true;
        switchSel.appendChild(opt);
      });
      switchSel.addEventListener("change", function() {
        if (!store()) return;
        store().setActiveCampaign(switchSel.value);
        if (_container) _draw(_container);
      });
      switcher.appendChild(switchLbl);
      switcher.appendChild(switchSel);
      mainRow.appendChild(switcher);
    }

    h.appendChild(mainRow);

    // Wire breadcrumb links after mount
    setTimeout(function() {
      var btnC = document.getElementById("campBcCampaign");
      if (btnC) btnC.addEventListener("click", function() { _navigate("overview"); });
      var btnP = document.getElementById("campBcProduction");
      if (btnP) btnP.addEventListener("click", function() { _navigate("production"); });
    }, 0);

    return h;
  }

  /* ---------- Sub-Nav ----------------------------------------------------- */
  function _renderSubNav() {
    var nav = el("nav", "camp-subnav");
    var tabs = [
      { id: "overview",   label: "Overview"   },
      { id: "production", label: "Production" },
      { id: "strategy",   label: "Strategy"   },
      { id: "assets",     label: "Assets"     },
      { id: "delivery",   label: "Delivery"   }
    ];
    tabs.forEach(function(tab) {
      var btn = el("button", "camp-subnav__tab" + (state.section === tab.id ? " is-active" : ""), tab.label);
      btn.addEventListener("click", function() { _navigate(tab.id); });
      nav.appendChild(btn);
    });
    return nav;
  }

  /* ---------- Overview ---------------------------------------------------- */
  function _renderOverview(container, CAMPAIGN) {
    var d        = CAMPAIGN.production.deliverables;
    var inReview = d.filter(function(x) { return x.status === "In Review"; }).length;
    var a        = CAMPAIGN.assets.files;

    // Derive linked asset count from deliverable.assetIds — source of truth
    var linkedIdSet = {};
    d.forEach(function(deliv) {
      (deliv.assetIds || []).forEach(function(id) { linkedIdSet[id] = true; });
    });
    var linked = a.filter(function(x) { return !!linkedIdSet[x.id]; }).length;

    var del      = CAMPAIGN.delivery;
    var ready    = del.items.filter(function(x) { return x.status === "Ready"; }).length;

    var intro = el("div", "camp-overview-intro");
    intro.innerHTML =
      '<h2 class="camp-overview-intro__title">Campaign Workspace</h2>' +
      '<p class="camp-overview-intro__subtitle">Operational hub for ' + CAMPAIGN.name + '. Navigate any section to dig in.</p>';
    container.appendChild(intro);

    var grid = el("div", "camp-overview-grid");

    // Production card
    var prodPills = d.slice(0, 3).map(function(x) {
      return '<span class="camp-ov-pill" style="--c:' + statusColor(x.status) + ';--b:' + statusBg(x.status) + '">' + x.title + '</span>';
    }).join("");

    grid.appendChild(_ovCard({
      section: "production",
      label:   "Production",
      icon:    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="7"/><polygon points="8,7 8,13 14,10" fill="currentColor" stroke="none" opacity="0.8"/></svg>',
      accent:  "#a78bfa",
      summary: d.length + " deliverables \u00b7 " + inReview + " in review",
      items:   prodPills,
      cta:     "Go to Production \u2192"
    }));

    // Strategy card
    var platformTags = CAMPAIGN.platforms.map(function(p) {
      return '<span class="camp-ov-tag">' + p + '</span>';
    }).join("");

    grid.appendChild(_ovCard({
      section: "strategy",
      label:   "Strategy",
      icon:    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 5h14M3 10h10M3 15h7" stroke-linecap="round"/></svg>',
      accent:  "#f59e0b",
      summary: CAMPAIGN.type + " \u00b7 " + CAMPAIGN.target,
      items:   platformTags,
      cta:     "Go to Strategy \u2192"
    }));

    // Assets card
    var assetTypes = ["Raw", "Edit", "Thumbnail", "Brand", "Document"];
    var assetTags = assetTypes.map(function(t) {
      var count = a.filter(function(x) { return x.type === t; }).length;
      return count > 0
        ? '<span class="camp-ov-tag" style="--c:' + assetTypeColor(t) + '">' + t + ' (' + count + ')</span>'
        : "";
    }).join("");

    grid.appendChild(_ovCard({
      section: "assets",
      label:   "Assets",
      icon:    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="16" height="13" rx="2"/><path d="M2 8h16" stroke-linecap="round"/></svg>',
      accent:  "#34d399",
      summary: a.length + " files \u00b7 " + linked + " linked to deliverables",
      items:   assetTags,
      cta:     "Go to Assets \u2192"
    }));

    // Delivery card
    var deliveryItems =
      '<div class="camp-ov-bar"><div class="camp-ov-bar__fill" style="width:' + del.readiness + '%"></div></div>' +
      '<p class="camp-ov-note">' + del.exportNotes + '</p>';

    grid.appendChild(_ovCard({
      section: "delivery",
      label:   "Delivery",
      icon:    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 10l4 4 8-8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      accent:  "#4ade80",
      summary: ready + " ready \u00b7 " + del.readiness + "% export readiness",
      items:   deliveryItems,
      cta:     "Go to Delivery \u2192"
    }));

    container.appendChild(grid);
  }

  function _ovCard(opts) {
    var card = el("div", "camp-ov-card");
    card.style.setProperty("--accent", opts.accent);
    card.innerHTML =
      '<div class="camp-ov-card__head">' +
        '<div class="camp-ov-card__icon">' + opts.icon + '</div>' +
        '<div class="camp-ov-card__label">' + opts.label + '</div>' +
      '</div>' +
      '<div class="camp-ov-card__summary">' + opts.summary + '</div>' +
      '<div class="camp-ov-card__items">' + opts.items + '</div>' +
      '<button class="camp-ov-card__cta">' + opts.cta + '</button>';
    card.addEventListener("click", function() { _navigate(opts.section); });
    return card;
  }

  /* ---------- Production -------------------------------------------------- */
  function _renderProduction(container, CAMPAIGN) {
    var d        = CAMPAIGN.production.deliverables;
    var inReview = d.filter(function(x) { return x.status === "In Review"; }).length;
    var approved = d.filter(function(x) { return x.status === "Approved"; }).length;

    var headerRow = el("div", "camp-page-header camp-page-header--row");
    var headerText = el("div");
    headerText.innerHTML =
      '<h2 class="camp-page-title">Production</h2>' +
      '<p class="camp-page-subtitle">' + d.length + ' deliverables \u00b7 ' + inReview + ' in review \u00b7 ' + approved + ' approved</p>';
    headerRow.appendChild(headerText);

    var newBtn = el("button", "camp-new-deliverable-btn", "+ New Deliverable");
    newBtn.addEventListener("click", function() {
      _showNewDeliverableForm(container, CAMPAIGN);
    });
    headerRow.appendChild(newBtn);
    container.appendChild(headerRow);

    // Sort: In Review → In Production → Draft → Approved
    var STATUS_SORT = { "In Review": 0, "In Production": 1, "Draft": 2, "Approved": 3 };
    var sorted = d.slice().sort(function(a, b) {
      return (STATUS_SORT[a.status] || 99) - (STATUS_SORT[b.status] || 99);
    });

    var grid = el("div", "camp-deliverable-grid");
    sorted.forEach(function(item) {
      var doneTasks  = (item.tasks || []).filter(function(t) { return t.done; }).length;
      var totalTasks = (item.tasks || []).length;
      var isPending  = item.status !== "Approved";

      var card = el("div", "camp-deliverable-card" + (isPending ? " camp-deliverable-card--pending" : ""));
      card.innerHTML =
        '<div class="camp-deliverable-card__top">' +
          '<div class="camp-deliverable-card__status" style="color:' + statusColor(item.status) + ';background:' + statusBg(item.status) + '">' + item.status + '</div>' +
          '<div class="camp-deliverable-card__version">' + item.version + '</div>' +
        '</div>' +
        '<div class="camp-deliverable-card__title">' + item.title + '</div>' +
        '<div class="camp-deliverable-card__meta">' +
          '<span class="camp-deliverable-card__platform">' + item.platform + '</span>' +
          '<span class="camp-deliverable-card__owner">' + item.owner + '</span>' +
          (totalTasks > 0
            ? '<span class="camp-deliverable-card__tasks">' + doneTasks + '/' + totalTasks + ' tasks</span>'
            : '') +
        '</div>' +
        '<div class="camp-deliverable-card__action">Open Focus View \u2192</div>';
      card.addEventListener("click", (function(id) {
        return function() { _navigate("production", id); };
      }(item.id)));
      grid.appendChild(card);
    });
    container.appendChild(grid);
  }

  /* ---------- New Deliverable Form --------------------------------------- */
  function _showNewDeliverableForm(container, CAMPAIGN) {
    // Remove existing modal if any
    var existing = document.getElementById("campNewDeliverableModal");
    if (existing) existing.remove();

    var overlay = el("div", "camp-modal-overlay");
    overlay.id = "campNewDeliverableModal";

    var modal = el("div", "camp-modal");
    modal.innerHTML =
      '<h3 class="camp-modal__title">New Deliverable</h3>' +
      '<div class="camp-modal__field">' +
        '<label class="camp-modal__label">Title</label>' +
        '<input class="camp-modal__input" id="cndTitle" type="text" placeholder="e.g. Hero Reel — Launch Day">' +
      '</div>' +
      '<div class="camp-modal__field">' +
        '<label class="camp-modal__label">Platform</label>' +
        '<select class="camp-modal__input" id="cndPlatform">' +
          '<option value="Instagram">Instagram</option>' +
          '<option value="TikTok">TikTok</option>' +
          '<option value="YouTube">YouTube</option>' +
          '<option value="YouTube Shorts">YouTube Shorts</option>' +
          '<option value="LinkedIn">LinkedIn</option>' +
          '<option value="Twitter">Twitter</option>' +
          '<option value="Other">Other</option>' +
        '</select>' +
      '</div>' +
      '<div class="camp-modal__field">' +
        '<label class="camp-modal__label">Owner</label>' +
        '<input class="camp-modal__input" id="cndOwner" type="text" placeholder="e.g. Sophie M.">' +
      '</div>' +
      '<div class="camp-modal__actions">' +
        '<button class="camp-modal__cancel" id="cndCancel">Cancel</button>' +
        '<button class="camp-modal__submit" id="cndSubmit">Create Deliverable</button>' +
      '</div>';

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    setTimeout(function() {
      var titleInput = document.getElementById("cndTitle");
      if (titleInput) titleInput.focus();

      var cancelBtn = document.getElementById("cndCancel");
      if (cancelBtn) cancelBtn.addEventListener("click", function() { overlay.remove(); });

      overlay.addEventListener("click", function(e) {
        if (e.target === overlay) overlay.remove();
      });

      var submitBtn = document.getElementById("cndSubmit");
      if (submitBtn) {
        submitBtn.addEventListener("click", function() {
          var title    = (document.getElementById("cndTitle") || {}).value || "";
          var platform = (document.getElementById("cndPlatform") || {}).value || "Instagram";
          var owner    = (document.getElementById("cndOwner") || {}).value || "";

          if (!title.trim()) {
            var t = document.getElementById("cndTitle");
            if (t) { t.style.borderColor = "#f87171"; t.focus(); }
            return;
          }

          if (!store()) return;
          var activeCampaign = store().getActiveCampaign();
          var campaignPrefix = activeCampaign ? activeCampaign.id : "c";
          var newDeliverable = {
            id:       campaignPrefix + "_d" + Date.now(),
            title:    title.trim(),
            platform: platform,
            owner:    owner.trim() || "\u2014",
            status:   "Draft",
            version:  "v1",
            bio:      "",
            caption:  "",
            tasks:    [],
            timeline: [],
            assetIds: [],
            feedback: "",
            analytics: { views: "\u2014", engagement: "\u2014", status: "Draft" }
          };

          store().updateActiveCampaign(function(campaign) {
            campaign.production.deliverables.push(newDeliverable);
            return campaign;
          });

          overlay.remove();
          if (_container) _draw(_container);
        });
      }
    }, 0);
  }

  /* ---------- Deliverable Focus ------------------------------------------ */
  function _renderDeliverableFocus(container, focusId, CAMPAIGN) {
    var deliverable = store() ? store().getDeliverable(focusId) : null;

    if (!deliverable) {
      container.innerHTML = '<p class="camp-muted">Deliverable not found.</p>';
      return;
    }

    // Back button
    var back = el("button", "camp-focus-back", "\u2190 Back to Production");
    back.addEventListener("click", function() { _navigate("production"); });
    container.appendChild(back);

    var layout = el("div", "camp-focus-layout");

    /* ---- Main panel ---- */
    var main = el("div", "camp-focus-main");

    // Focus header
    var focusHeader = el("div", "camp-focus-header");
    focusHeader.innerHTML =
      '<div class="camp-focus-header__top">' +
        '<h2 class="camp-focus-header__title">' + deliverable.title + '</h2>' +
        '<div class="camp-focus-header__badges">' +
          '<span class="camp-focus-badge" style="color:' + statusColor(deliverable.status) + ';background:' + statusBg(deliverable.status) + '">' + deliverable.status + '</span>' +
          '<span class="camp-focus-badge camp-focus-badge--platform">' + deliverable.platform + '</span>' +
          '<span class="camp-focus-badge camp-focus-badge--version">' + deliverable.version + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="camp-focus-owner">Owner: <strong>' + deliverable.owner + '</strong></div>';
    main.appendChild(focusHeader);

    // Brief / Caption (editable)
    (function() {
      var bioCard = el("div", "camp-focus-card");
      var bioLabel = el("div", "camp-focus-card__label", "Brief");
      var bioArea = el("textarea", "camp-focus-edit-textarea");
      bioArea.value = deliverable.bio || "";
      bioArea.placeholder = "Add a brief description\u2026";
      bioArea.rows = 4;
      bioArea.addEventListener("blur", function() {
        if (!store()) return;
        var newVal = bioArea.value;
        store().updateDeliverable(focusId, function(d) { d.bio = newVal; return d; });
      });

      var captionLabel = el("div", "camp-focus-card__label camp-focus-card__label--secondary", "Caption");
      var captionArea = el("textarea", "camp-focus-edit-textarea camp-focus-edit-textarea--caption");
      captionArea.value = deliverable.caption || "";
      captionArea.placeholder = "Add a caption\u2026";
      captionArea.rows = 2;
      captionArea.addEventListener("blur", function() {
        if (!store()) return;
        var newVal = captionArea.value;
        store().updateDeliverable(focusId, function(d) { d.caption = newVal; return d; });
      });

      bioCard.appendChild(bioLabel);
      bioCard.appendChild(bioArea);
      bioCard.appendChild(captionLabel);
      bioCard.appendChild(captionArea);
      main.appendChild(bioCard);
    }());

    // Tasks -- interactive: clicking a row toggles done and persists to store
    if (deliverable.tasks && deliverable.tasks.length) {
      var tasksCard = el("div", "camp-focus-card");
      var taskLabel = el("div", "camp-focus-card__label", "Tasks");
      tasksCard.appendChild(taskLabel);

      var taskList = el("ul", "camp-focus-tasks");
      deliverable.tasks.forEach(function(t) {
        var li = el("li", "camp-focus-task" + (t.done ? " is-done" : ""));

        var check = el("span", "camp-focus-task__check", t.done ? "\u2713" : "\u25cb");
        var text  = el("span", "camp-focus-task__text", t.text);

        li.appendChild(check);
        li.appendChild(text);

        li.addEventListener("click", (function(taskId, delId) {
          return function() {
            if (!store()) return;
            store().updateDeliverable(delId, function(d) {
              d.tasks = d.tasks.map(function(task) {
                return task.id === taskId
                  ? { id: task.id, text: task.text, done: !task.done }
                  : task;
              });
              return d;
            });
            if (_container) _draw(_container);
          };
        }(t.id, focusId)));

        taskList.appendChild(li);
      });
      tasksCard.appendChild(taskList);
      main.appendChild(tasksCard);
    }

    // Timeline
    if (deliverable.timeline && deliverable.timeline.length) {
      var tlCard = el("div", "camp-focus-card");
      var tlHTML = '<div class="camp-focus-card__label">Timeline</div><ul class="camp-focus-timeline">';
      deliverable.timeline.forEach(function(t, i) {
        var isLast = (i === deliverable.timeline.length - 1);
        tlHTML +=
          '<li class="camp-focus-tl-item">' +
            '<span class="camp-focus-tl-item__date">' + t.date + '</span>' +
            '<div class="camp-focus-tl-item__dot-wrap">' +
              '<span class="camp-focus-tl-item__dot' + (isLast ? ' is-last' : '') + '"></span>' +
              '<span class="camp-focus-tl-item__line"></span>' +
            '</div>' +
            '<span class="camp-focus-tl-item__event">' + t.event + '</span>' +
          '</li>';
      });
      tlHTML += '</ul>';
      tlCard.innerHTML = tlHTML;
      main.appendChild(tlCard);
    }

    // Linked assets — resolved from assetIds via store
    (function() {
      var linkedAssets = store() ? store().getAssetsForDeliverable(focusId) : [];
      var assetsCard   = el("div", "camp-focus-card");

      var cardLabel = el("div", "camp-focus-card__label", "Linked Assets");
      assetsCard.appendChild(cardLabel);

      if (linkedAssets.length) {
        var assetList = el("ul", "camp-focus-asset-list");
        linkedAssets.forEach(function(asset) {
          var li      = el("li", "camp-focus-asset-item");
          var icon    = el("span", "camp-focus-asset-icon", "\ud83d\udcce");
          var info    = el("div", "camp-focus-asset-info");
          var name    = el("span", "camp-focus-asset-name", asset.name);
          var meta    = el("span", "camp-focus-asset-meta", asset.type + " \u00b7 " + asset.size + " \u00b7 " + asset.date);
          var unlinkBtn = el("button", "camp-focus-asset-unlink", "\u00d7");
          unlinkBtn.title = "Unlink asset";
          unlinkBtn.addEventListener("click", function(e) {
            e.stopPropagation();
            if (!store()) return;
            store().unlinkAssetFromDeliverable(asset.id, focusId);
            if (_container) _draw(_container);
          });

          info.appendChild(name);
          info.appendChild(meta);
          li.appendChild(icon);
          li.appendChild(info);
          li.appendChild(unlinkBtn);
          assetList.appendChild(li);
        });
        assetsCard.appendChild(assetList);
      } else {
        var emptyNote = el("p", "camp-focus-asset-empty", "No assets linked yet.");
        assetsCard.appendChild(emptyNote);
      }

      // "Link from Supply" placeholder
      var linkRow = el("div", "camp-focus-asset-link-row");

      var allAssets    = store() ? store().getAssets() : [];
      var linkedIds    = linkedAssets.map(function(a) { return a.id; });
      var available    = allAssets.filter(function(a) { return linkedIds.indexOf(a.id) === -1; });

      if (available.length) {
        var linkSelect = el("select", "camp-focus-asset-select");
        var placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Add linked asset\u2026";
        linkSelect.appendChild(placeholder);
        available.forEach(function(a) {
          var opt = document.createElement("option");
          opt.value = a.id;
          opt.textContent = a.name + " (" + a.type + ")";
          linkSelect.appendChild(opt);
        });

        var linkBtn = el("button", "camp-focus-asset-link-btn", "Link");
        linkBtn.addEventListener("click", function() {
          var selectedId = linkSelect.value;
          if (!selectedId || !store()) return;
          store().linkAssetToDeliverable(selectedId, focusId);
          if (_container) _draw(_container);
        });

        linkRow.appendChild(linkSelect);
        linkRow.appendChild(linkBtn);
      }

      assetsCard.appendChild(linkRow);
      main.appendChild(assetsCard);
    }());

    // Feedback (editable)
    (function() {
      var fbCard = el("div", "camp-focus-card");
      var fbLabel = el("div", "camp-focus-card__label", "Latest Feedback");
      var fbArea = el("textarea", "camp-focus-edit-textarea camp-focus-edit-textarea--feedback");
      fbArea.value = deliverable.feedback || "";
      fbArea.placeholder = "Add feedback notes\u2026";
      fbArea.rows = 3;
      fbArea.addEventListener("blur", function() {
        if (!store()) return;
        var newVal = fbArea.value;
        store().updateDeliverable(focusId, function(d) { d.feedback = newVal; return d; });
      });
      fbCard.appendChild(fbLabel);
      fbCard.appendChild(fbArea);
      main.appendChild(fbCard);
    }());

    layout.appendChild(main);

    /* ---- Sidebar panel ---- */
    var sidebar = el("div", "camp-focus-sidebar");

    // Media preview placeholder
    var preview = el("div", "camp-focus-preview");
    preview.innerHTML =
      '<div class="camp-focus-preview__placeholder">' +
        '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.5">' +
          '<rect x="4" y="6" width="32" height="24" rx="3"/>' +
          '<polygon points="16,12 16,22 26,17" fill="currentColor" stroke="none" opacity="0.6"/>' +
        '</svg>' +
        '<span>Media Preview</span>' +
      '</div>';
    sidebar.appendChild(preview);

    // Analytics
    if (deliverable.analytics) {
      var analyticsCard = el("div", "camp-focus-analytics");
      analyticsCard.innerHTML =
        '<div class="camp-focus-card__label">Analytics</div>' +
        '<div class="camp-focus-analytics__grid">' +
          '<div class="camp-focus-analytics__item">' +
            '<span class="camp-focus-analytics__val">' + deliverable.analytics.views + '</span>' +
            '<span class="camp-focus-analytics__key">Views</span>' +
          '</div>' +
          '<div class="camp-focus-analytics__item">' +
            '<span class="camp-focus-analytics__val">' + deliverable.analytics.engagement + '</span>' +
            '<span class="camp-focus-analytics__key">Engagement</span>' +
          '</div>' +
        '</div>' +
        '<div class="camp-focus-analytics__status">' + deliverable.analytics.status + '</div>';
      sidebar.appendChild(analyticsCard);
    }

    // Strategy recall button
    var strategyBtn = el("button", "camp-focus-strategy-recall");
    strategyBtn.innerHTML =
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">' +
        '<path d="M2 4h12M2 8h9M2 12h6" stroke-linecap="round"/>' +
      '</svg>' +
      'Strategy Brief';
    strategyBtn.addEventListener("click", function() { _navigate("strategy"); });
    sidebar.appendChild(strategyBtn);

    layout.appendChild(sidebar);
    container.appendChild(layout);
  }

  /* ---------- Strategy ---------------------------------------------------- */
  function _renderStrategy(container, CAMPAIGN) {
    var layout = el("div", "camp-strategy-layout");

    /* ---- Main content ---- */
    var main = el("div", "camp-strategy-main");

    var header = el("div", "camp-page-header");
    header.innerHTML =
      '<h2 class="camp-page-title">Strategy</h2>' +
      '<p class="camp-page-subtitle">Campaign reference framework for ' + CAMPAIGN.name + '</p>';
    main.appendChild(header);

    // Editable fields: goal, target, messaging
    var editableFields = [
      { label: "Campaign Goal",   key: "goal",      rows: 3 },
      { label: "Target Audience", key: "target",    rows: 2 },
      { label: "Core Messaging",  key: "messaging", rows: 3 }
    ];

    editableFields.forEach(function(f) {
      var card = el("div", "camp-strategy-card");
      var lbl  = el("div", "camp-strategy-card__label", f.label);
      var area = el("textarea", "camp-strategy-edit-textarea");
      area.value = CAMPAIGN[f.key] || "";
      area.rows  = f.rows;
      area.addEventListener("blur", function() {
        if (!store()) return;
        var newVal = area.value;
        var fieldKey = f.key;
        store().updateActiveCampaign(function(c) {
          c[fieldKey] = newVal;
          return c;
        });
      });
      card.appendChild(lbl);
      card.appendChild(area);
      main.appendChild(card);
    });

    // Blackboard — thinking surface
    (function() {
      var bb = el("div", "camp-blackboard");

      var bbHeader = el("div", "camp-blackboard__header");
      bbHeader.appendChild(el("span", "camp-blackboard__label", "Thinking Surface"));
      bbHeader.appendChild(el("span", "camp-blackboard__hint",
        "Hook \u00b7 Tone \u00b7 Direction \u00b7 Notes"));
      bb.appendChild(bbHeader);

      var bbArea = el("textarea", "camp-blackboard__area");
      bbArea.value = CAMPAIGN.blackboard || "";
      bbArea.rows  = 5;
      bbArea.placeholder =
        "Hook: \u2026\nTone: \u2026\nDirection: \u2026";
      bbArea.addEventListener("blur", function() {
        if (!store()) return;
        var newVal = bbArea.value;
        store().updateActiveCampaign(function(c) {
          c.blackboard = newVal;
          return c;
        });
      });
      bb.appendChild(bbArea);

      main.appendChild(bb);
    }());

    // Read-only fields
    var readOnlyFields = [
      { label: "Geographic Focus",    value: CAMPAIGN.location      },
      { label: "Campaign Objectives", value: CAMPAIGN.campaignGoals }
    ];

    readOnlyFields.forEach(function(s) {
      var card = el("div", "camp-strategy-card");
      card.innerHTML =
        '<div class="camp-strategy-card__label">' + s.label + '</div>' +
        '<div class="camp-strategy-card__value">' + s.value + '</div>';
      main.appendChild(card);
    });

    // Platforms
    var platCard = el("div", "camp-strategy-card");
    var platTags = CAMPAIGN.platforms.map(function(p) {
      return '<span class="camp-strategy-tag">' + p + '</span>';
    }).join("");
    platCard.innerHTML =
      '<div class="camp-strategy-card__label">Platforms</div>' +
      '<div class="camp-strategy-card__tags">' + platTags + '</div>';
    main.appendChild(platCard);

    layout.appendChild(main);

    /* ---- Campaign Strategy Rail ---- */
    var rail = el("aside", "camp-strategy-rail");
    rail.innerHTML = '<div class="camp-strategy-rail__title">Campaign Strategy</div>';

    var railFields = [
      { label: "Name",           value: CAMPAIGN.name          },
      { label: "Client",         value: CAMPAIGN.client        },
      { label: "Goal",           value: CAMPAIGN.goal          },
      { label: "Type",           value: CAMPAIGN.type          },
      { label: "Duration",       value: CAMPAIGN.duration      },
      { label: "Platforms",      value: CAMPAIGN.platforms.join(", ") },
      { label: "Target",         value: CAMPAIGN.target        },
      { label: "Audience",       value: CAMPAIGN.audience      },
      { label: "Location",       value: CAMPAIGN.location      },
      { label: "Campaign Goals", value: CAMPAIGN.campaignGoals },
      { label: "Messaging",      value: CAMPAIGN.messaging     }
    ];

    railFields.forEach(function(f) {
      var row = el("div", "camp-strategy-rail__row");
      row.innerHTML =
        '<div class="camp-strategy-rail__label">' + f.label + '</div>' +
        '<div class="camp-strategy-rail__value">' + f.value + '</div>';
      rail.appendChild(row);
    });

    layout.appendChild(rail);
    container.appendChild(layout);
  }

  /* ---------- Assets ------------------------------------------------------ */
  function _renderAssets(container, CAMPAIGN) {
    var a = CAMPAIGN.assets.files;

    // Derive linked count from deliverable.assetIds — source of truth
    var linkedIdSet = {};
    (CAMPAIGN.production.deliverables || []).forEach(function(d) {
      (d.assetIds || []).forEach(function(id) { linkedIdSet[id] = true; });
    });
    var linked = a.filter(function(x) { return !!linkedIdSet[x.id]; }).length;

    var header = el("div", "camp-page-header");
    header.innerHTML =
      '<h2 class="camp-page-title">Assets</h2>' +
      '<p class="camp-page-subtitle">' + a.length + ' files \u00b7 ' + linked + ' linked to deliverables \u00b7 ' + CAMPAIGN.name + '</p>';
    container.appendChild(header);

    // Category summary
    var cats = ["Raw", "Edit", "Thumbnail", "Brand", "Document"];
    var catRow = el("div", "camp-asset-cats");
    cats.forEach(function(c) {
      var count   = a.filter(function(x) { return x.type === c; }).length;
      var catChip = el("div", "camp-asset-cat" + (count === 0 ? " is-empty" : ""));
      catChip.style.setProperty("--c", assetTypeColor(c));
      catChip.innerHTML =
        '<span class="camp-asset-cat__label">' + c + '</span>' +
        '<span class="camp-asset-cat__count">' + count + '</span>';
      catRow.appendChild(catChip);
    });
    container.appendChild(catRow);

    // File list
    var list = el("div", "camp-asset-list");
    a.forEach(function(file) {
      var c   = assetTypeColor(file.type);
      var rgb = _hexToRgb(c);
      var item = el("div", "camp-asset-item");
      item.innerHTML =
        '<div class="camp-asset-item__type" style="color:' + c + ';background:rgba(' + rgb + ',0.1)">' + file.type + '</div>' +
        '<div class="camp-asset-item__name">' + file.name + '</div>' +
        '<div class="camp-asset-item__meta">' +
          '<span>' + file.size + '</span>' +
          '<span>' + file.date + '</span>' +
          (linkedIdSet[file.id] ? '<span class="camp-asset-item__linked">Linked</span>' : "") +
        '</div>';
      list.appendChild(item);
    });
    container.appendChild(list);
  }

  function _hexToRgb(hex) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return r + "," + g + "," + b;
  }

  /* ---------- Delivery ---------------------------------------------------- */
  function _renderDelivery(container, CAMPAIGN) {
    var del   = CAMPAIGN.delivery;
    var ready = del.items.filter(function(x) { return x.status === "Ready"; }).length;

    var layout = el("div", "camp-delivery-layout");

    /* ---- ROW 1 — Hero / Readiness ---- */
    var hero = el("div", "camp-delivery-hero");
    hero.innerHTML =
      '<div class="camp-delivery-hero__eyebrow">Campaign Package Readiness</div>' +
      '<div class="camp-delivery-hero__pct">' + del.readiness + '%</div>' +
      '<div class="camp-delivery-hero__bar-wrap">' +
        '<div class="camp-delivery-hero__bar">' +
          '<div class="camp-delivery-hero__fill" style="width:' + del.readiness + '%"></div>' +
        '</div>' +
      '</div>' +
      '<div class="camp-delivery-hero__foot">' +
        '<span class="camp-delivery-hero__stat">' + ready + '\u202f/\u202f' + del.items.length + ' deliverables ready</span>' +
        '<span class="camp-delivery-hero__notes">' + del.exportNotes + '</span>' +
      '</div>';
    layout.appendChild(hero);

    /* ---- ROW 2 — Primary Actions ---- */
    var actions = el("div", "camp-delivery-actions");

    var createBtn = el("button", "camp-delivery-action camp-delivery-action--create");
    createBtn.innerHTML =
      '<span class="camp-delivery-action__title">Create Project File</span>' +
      '<span class="camp-delivery-action__hint">Package all ready deliverables</span>';
    actions.appendChild(createBtn);

    var sendBtn = el("button", "camp-delivery-action camp-delivery-action--send");
    sendBtn.innerHTML =
      '<span class="camp-delivery-action__title">Send File</span>' +
      '<span class="camp-delivery-action__hint">Share with client or team</span>';
    actions.appendChild(sendBtn);

    layout.appendChild(actions);

    /* ---- ROW 3 — Deliverables List ---- */
    var contents = el("div", "camp-delivery-contents");
    var contentsLabel = el("div", "camp-delivery-contents__label", "Deliverables");
    contents.appendChild(contentsLabel);

    var list = el("div", "camp-delivery-list");
    del.items.forEach(function(item) {
      var card = el("div", "camp-delivery-item");

      var topRow = el("div", "camp-delivery-item__top");

      // Status dropdown
      var statusSel = el("select", "camp-delivery-status-select");
      statusSel.style.color = statusColor(item.status);
      ["Draft", "In Review", "Ready"].forEach(function(s) {
        var opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        if (s === item.status) opt.selected = true;
        statusSel.appendChild(opt);
      });
      statusSel.addEventListener("change", function() {
        var newStatus = statusSel.value;
        var itemId = item.id;
        if (!store()) return;
        store().updateActiveCampaign(function(c) {
          c.delivery.items = c.delivery.items.map(function(i) {
            return i.id === itemId ? Object.assign({}, i, { status: newStatus }) : i;
          });
          var total  = c.delivery.items.length;
          var rdyCount = c.delivery.items.filter(function(i) { return i.status === "Ready"; }).length;
          c.delivery.readiness = total ? Math.round((rdyCount / total) * 100) : 0;
          return c;
        });
        if (_container) _draw(_container);
      });

      var platformBadge = el("span", "camp-delivery-item__platform", item.platform);

      topRow.appendChild(statusSel);
      topRow.appendChild(platformBadge);

      var titleEl = el("div", "camp-delivery-item__title", item.title);
      var metaEl  = el("div", "camp-delivery-item__meta");
      metaEl.innerHTML =
        '<span class="camp-delivery-item__owner">' + item.owner + '</span>' +
        '<span class="camp-delivery-item__notes">' + item.notes + '</span>';

      card.appendChild(topRow);
      card.appendChild(titleEl);
      card.appendChild(metaEl);

      if (item.status === "Ready") {
        var exportBtn = el("button", "camp-delivery-item__export", "Export \u2192");
        card.appendChild(exportBtn);
      }

      list.appendChild(card);
    });
    contents.appendChild(list);
    layout.appendChild(contents);

    container.appendChild(layout);
  }

  /* ---------- Entry Point ------------------------------------------------- */
  function render(container) {
    state.section = "overview";
    state.focus   = null;
    _draw(container);
  }

  window.CampaignModule = { render: render, navigate: _navigate };

}());
