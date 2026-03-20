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

  /* ---------- Mock Data --------------------------------------------------- */
  var CAMPAIGN = {
    name:          "Summer Drop 2025",
    client:        "Natura Vitae",
    goal:          "Launch seasonal product line with creator-led storytelling",
    type:          "Product Launch",
    duration:      "Jun 1 – Aug 31, 2025",
    platforms:     ["Instagram", "TikTok", "YouTube"],
    target:        "18–34, wellness-focused millennials",
    audience:      "Health-conscious consumers and lifestyle enthusiasts seeking clean beauty",
    location:      "US, CA, UK",
    campaignGoals: "Drive 40% awareness uplift and 15% conversion on new summer SKUs",
    messaging:     "Pure, natural, summer vitality — effortless wellness woven into your everyday routine",

    production: {
      deliverables: [
        { id: "d1", title: "Hero Reel — Launch Day",      status: "In Review",     platform: "Instagram", owner: "Yuki T.",    version: "v2" },
        { id: "d2", title: "Summer Glow Tutorial",         status: "In Production", platform: "YouTube",   owner: "Sophie M.", version: "v1" },
        { id: "d3", title: "Product Close-up Teaser",      status: "Approved",      platform: "TikTok",    owner: "Carlos L.", version: "v3" },
        { id: "d4", title: "Creator Testimonial Cut",      status: "Draft",         platform: "Instagram", owner: "Amara K.",  version: "v1" },
        { id: "d5", title: "BTS Story Set",                status: "In Review",     platform: "Instagram", owner: "Yuki T.",   version: "v1" }
      ]
    },

    assets: {
      files: [
        { id: "a1", name: "hero-shot-final.mp4",      type: "Raw",       size: "2.3 GB", date: "Mar 15", linked: true  },
        { id: "a2", name: "brand-kit-2025.zip",       type: "Brand",     size: "145 MB", date: "Mar 10", linked: true  },
        { id: "a3", name: "product-close-edit.mp4",   type: "Edit",      size: "890 MB", date: "Mar 17", linked: false },
        { id: "a4", name: "thumbnail-set-v2.psd",     type: "Thumbnail", size: "78 MB",  date: "Mar 18", linked: true  },
        { id: "a5", name: "campaign-brief.pdf",       type: "Document",  size: "4.2 MB", date: "Mar 8",  linked: true  },
        { id: "a6", name: "raw-footage-day1.mov",     type: "Raw",       size: "8.1 GB", date: "Mar 12", linked: false }
      ]
    },

    delivery: {
      items: [
        { id: "e1", title: "Product Close-up Teaser", status: "Ready",     platform: "TikTok",    owner: "Carlos L.", notes: "Approved by client Mar 15" },
        { id: "e2", title: "Hero Reel — Launch Day",  status: "In Review", platform: "Instagram", owner: "Yuki T.",   notes: "Final client approval pending" },
        { id: "e3", title: "Creator Testimonial Cut", status: "Draft",     platform: "Instagram", owner: "Amara K.",  notes: "Awaiting final footage" }
      ],
      readiness:   72,
      exportNotes: "Hero Reel pending final color grade. TikTok cut ready for export."
    }
  };

  var DELIVERABLE_DETAIL = {
    d1: {
      bio:      "The flagship launch reel for Summer Drop 2025. Full-format vertical for Instagram feed + Reels. Hero product storytelling with lifestyle overlay and voice-over narration.",
      caption:  "Summer is here. Your glow, elevated. 🌿 #NaturaVitae #SummerDrop25",
      tasks: [
        { id: "t1", text: "Final color grade review",    done: true  },
        { id: "t2", text: "Sound mix approval",          done: true  },
        { id: "t3", text: "Client brand sign-off",       done: false },
        { id: "t4", text: "Export 4K archive + web cut", done: false }
      ],
      timeline: [
        { date: "Mar 10", event: "Brief received"              },
        { date: "Mar 13", event: "v1 delivered to client"      },
        { date: "Mar 16", event: "v2 delivered after feedback" },
        { date: "Mar 20", event: "Final delivery deadline"     }
      ],
      assets:   ["hero-shot-final.mp4", "brand-kit-2025.zip"],
      feedback: "Color grade is excellent on v2. Just need final sign-off from client brand team before final export.",
      analytics: { views: "—", engagement: "—", status: "Pre-release" }
    },
    d2: {
      bio:     "Long-form tutorial for YouTube. Step-by-step product usage with creator voice-over. Warm, educational tone with clear CTAs.",
      caption: "Your summer glow routine, simplified. Watch now 🌞 #NaturaVitae",
      tasks: [
        { id: "t1", text: "Script finalization",  done: true  },
        { id: "t2", text: "B-roll shot list",      done: true  },
        { id: "t3", text: "Primary shoot",         done: false },
        { id: "t4", text: "First edit assembly",   done: false }
      ],
      timeline: [
        { date: "Mar 12", event: "Script approved"       },
        { date: "Mar 19", event: "Shoot scheduled"       },
        { date: "Mar 26", event: "First cut delivery"    },
        { date: "Apr 3",  event: "Final deadline"        }
      ],
      assets:   ["raw-footage-day1.mov", "brand-kit-2025.zip"],
      feedback: "Script looks great. Ready to shoot next week.",
      analytics: { views: "—", engagement: "—", status: "Pre-production" }
    },
    d3: {
      bio:     "Short-form product close-up for TikTok. High visual impact, no dialogue. Clean beauty shots with kinetic editing and trending audio.",
      caption: "Clean beauty that moves 💫 #SummerDrop #NaturaVitae #CleanBeauty",
      tasks: [
        { id: "t1", text: "Visual brief approved",      done: true },
        { id: "t2", text: "Product shots captured",     done: true },
        { id: "t3", text: "Edit v1 + v2 + v3 complete", done: true },
        { id: "t4", text: "Client sign-off received",   done: true }
      ],
      timeline: [
        { date: "Mar 5",  event: "Shot list approved" },
        { date: "Mar 8",  event: "Shoot completed"    },
        { date: "Mar 12", event: "v1 delivered"       },
        { date: "Mar 15", event: "Approved by client" }
      ],
      assets:   ["product-close-edit.mp4", "thumbnail-set-v2.psd"],
      feedback: "Perfect. Approved. Ready for delivery pipeline.",
      analytics: { views: "—", engagement: "—", status: "Ready for export" }
    },
    d4: {
      bio:     "Creator testimonial cut featuring Amara K. giving her personal story about the product. Authentic, unscripted feel with light editing.",
      caption: "This changed my morning routine 🌿 @NaturaVitae #GlowFromWithin",
      tasks: [
        { id: "t1", text: "Creator brief sent",   done: true  },
        { id: "t2", text: "Filming scheduled",    done: false },
        { id: "t3", text: "Raw footage received", done: false },
        { id: "t4", text: "First edit",           done: false }
      ],
      timeline: [
        { date: "Mar 14", event: "Creator briefed"      },
        { date: "Mar 22", event: "Filming date"         },
        { date: "Mar 28", event: "First cut delivery"   },
        { date: "Apr 4",  event: "Final deadline"       }
      ],
      assets:   ["brand-kit-2025.zip", "campaign-brief.pdf"],
      feedback: "Waiting on creator to confirm filming date.",
      analytics: { views: "—", engagement: "—", status: "Pre-production" }
    },
    d5: {
      bio:     "Instagram Story set documenting behind-the-scenes of the Summer Drop shoot. Casual, authentic day-in-the-life format. 6–8 story slides.",
      caption: "Behind the scenes of our favourite shoot yet 📸 #NaturaVitae",
      tasks: [
        { id: "t1", text: "Story structure outline",   done: true  },
        { id: "t2", text: "BTS footage compiled",      done: true  },
        { id: "t3", text: "Story design + overlays",   done: false },
        { id: "t4", text: "Client review",             done: false }
      ],
      timeline: [
        { date: "Mar 11", event: "Footage collected" },
        { date: "Mar 17", event: "v1 assembled"      },
        { date: "Mar 21", event: "Client review"     },
        { date: "Mar 24", event: "Final delivery"    }
      ],
      assets:   ["hero-shot-final.mp4", "thumbnail-set-v2.psd"],
      feedback: "BTS footage is great. Need to add Natura Vitae story overlays and branded frames.",
      analytics: { views: "—", engagement: "—", status: "In review" }
    }
  };

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

    var shell = el("div", "camp-shell");

    // Header (always shown)
    shell.appendChild(_renderHeader());

    // Sub-nav (hidden when in deliverable focus)
    if (!state.focus) {
      shell.appendChild(_renderSubNav());
    }

    // Main content area
    var content = el("div", "camp-content");
    if (state.focus) {
      _renderDeliverableFocus(content, state.focus);
    } else {
      switch (state.section) {
        case "overview":   _renderOverview(content);   break;
        case "production": _renderProduction(content); break;
        case "strategy":   _renderStrategy(content);   break;
        case "assets":     _renderAssets(content);     break;
        case "delivery":   _renderDelivery(content);   break;
        default:           _renderOverview(content);
      }
    }
    shell.appendChild(content);
    container.appendChild(shell);
  }

  /* ---------- Header ------------------------------------------------------ */
  function _renderHeader() {
    var h = el("div", "camp-header");
    var breadcrumb = el("div", "camp-breadcrumb");

    if (state.focus) {
      var focusItem = CAMPAIGN.production.deliverables.filter(function(d) { return d.id === state.focus; })[0];
      breadcrumb.innerHTML =
        "<button class=\"camp-breadcrumb__link\" id=\"campBcCampaign\">Campaign</button>" +
        "<span class=\"camp-breadcrumb__sep\">›</span>" +
        "<button class=\"camp-breadcrumb__link\" id=\"campBcProduction\">Production</button>" +
        "<span class=\"camp-breadcrumb__sep\">›</span>" +
        "<span class=\"camp-breadcrumb__current\">" + (focusItem ? focusItem.title : "Deliverable") + "</span>";
    } else if (state.section === "overview") {
      breadcrumb.innerHTML = "<span class=\"camp-breadcrumb__current\">Campaign</span>";
    } else {
      var label = state.section.charAt(0).toUpperCase() + state.section.slice(1);
      breadcrumb.innerHTML =
        "<button class=\"camp-breadcrumb__link\" id=\"campBcCampaign\">Campaign</button>" +
        "<span class=\"camp-breadcrumb__sep\">›</span>" +
        "<span class=\"camp-breadcrumb__current\">" + label + "</span>";
    }
    h.appendChild(breadcrumb);

    var main = el("div", "camp-header__main");
    main.innerHTML =
      "<h1 class=\"camp-header__name\">" + CAMPAIGN.name + "</h1>" +
      "<div class=\"camp-header__meta\">" +
        "<span class=\"camp-header__client\">" + CAMPAIGN.client + "</span>" +
        "<span class=\"camp-header__dot\">·</span>" +
        "<span class=\"camp-header__type\">" + CAMPAIGN.type + "</span>" +
        "<span class=\"camp-header__dot\">·</span>" +
        "<span class=\"camp-header__duration\">" + CAMPAIGN.duration + "</span>" +
      "</div>";
    h.appendChild(main);

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
  function _renderOverview(container) {
    var d        = CAMPAIGN.production.deliverables;
    var inReview = d.filter(function(x) { return x.status === "In Review"; }).length;
    var a        = CAMPAIGN.assets.files;
    var linked   = a.filter(function(x) { return x.linked; }).length;
    var del      = CAMPAIGN.delivery;
    var ready    = del.items.filter(function(x) { return x.status === "Ready"; }).length;

    var intro = el("div", "camp-overview-intro");
    intro.innerHTML =
      "<h2 class=\"camp-overview-intro__title\">Campaign Workspace</h2>" +
      "<p class=\"camp-overview-intro__subtitle\">Operational hub for " + CAMPAIGN.name + ". Navigate any section to dig in.</p>";
    container.appendChild(intro);

    var grid = el("div", "camp-overview-grid");

    // Production card
    var prodPills = d.slice(0, 3).map(function(x) {
      return "<span class=\"camp-ov-pill\" style=\"--c:" + statusColor(x.status) + ";--b:" + statusBg(x.status) + "\">" + x.title + "</span>";
    }).join("");

    grid.appendChild(_ovCard({
      section: "production",
      label:   "Production",
      icon:    "<svg viewBox=\"0 0 20 20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"><circle cx=\"10\" cy=\"10\" r=\"7\"/><polygon points=\"8,7 8,13 14,10\" fill=\"currentColor\" stroke=\"none\" opacity=\"0.8\"/></svg>",
      accent:  "#a78bfa",
      summary: d.length + " deliverables · " + inReview + " in review",
      items:   prodPills,
      cta:     "Go to Production →"
    }));

    // Strategy card
    var platformTags = CAMPAIGN.platforms.map(function(p) {
      return "<span class=\"camp-ov-tag\">" + p + "</span>";
    }).join("");

    grid.appendChild(_ovCard({
      section: "strategy",
      label:   "Strategy",
      icon:    "<svg viewBox=\"0 0 20 20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"><path d=\"M3 5h14M3 10h10M3 15h7\" stroke-linecap=\"round\"/></svg>",
      accent:  "#f59e0b",
      summary: CAMPAIGN.type + " · " + CAMPAIGN.target,
      items:   platformTags,
      cta:     "Go to Strategy →"
    }));

    // Assets card
    var assetTypes = ["Raw", "Edit", "Thumbnail", "Brand", "Document"];
    var assetTags = assetTypes.map(function(t) {
      var count = a.filter(function(x) { return x.type === t; }).length;
      return count > 0
        ? "<span class=\"camp-ov-tag\" style=\"--c:" + assetTypeColor(t) + "\">" + t + " (" + count + ")</span>"
        : "";
    }).join("");

    grid.appendChild(_ovCard({
      section: "assets",
      label:   "Assets",
      icon:    "<svg viewBox=\"0 0 20 20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"><rect x=\"2\" y=\"4\" width=\"16\" height=\"13\" rx=\"2\"/><path d=\"M2 8h16\" stroke-linecap=\"round\"/></svg>",
      accent:  "#34d399",
      summary: a.length + " files · " + linked + " linked to deliverables",
      items:   assetTags,
      cta:     "Go to Assets →"
    }));

    // Delivery card
    var deliveryItems =
      "<div class=\"camp-ov-bar\"><div class=\"camp-ov-bar__fill\" style=\"width:" + del.readiness + "%\"></div></div>" +
      "<p class=\"camp-ov-note\">" + del.exportNotes + "</p>";

    grid.appendChild(_ovCard({
      section: "delivery",
      label:   "Delivery",
      icon:    "<svg viewBox=\"0 0 20 20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"><path d=\"M4 10l4 4 8-8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
      accent:  "#4ade80",
      summary: ready + " ready · " + del.readiness + "% export readiness",
      items:   deliveryItems,
      cta:     "Go to Delivery →"
    }));

    container.appendChild(grid);
  }

  function _ovCard(opts) {
    var card = el("div", "camp-ov-card");
    card.style.setProperty("--accent", opts.accent);
    card.innerHTML =
      "<div class=\"camp-ov-card__head\">" +
        "<div class=\"camp-ov-card__icon\">" + opts.icon + "</div>" +
        "<div class=\"camp-ov-card__label\">" + opts.label + "</div>" +
      "</div>" +
      "<div class=\"camp-ov-card__summary\">" + opts.summary + "</div>" +
      "<div class=\"camp-ov-card__items\">" + opts.items + "</div>" +
      "<button class=\"camp-ov-card__cta\">" + opts.cta + "</button>";
    card.addEventListener("click", function() { _navigate(opts.section); });
    return card;
  }

  /* ---------- Production -------------------------------------------------- */
  function _renderProduction(container) {
    var d        = CAMPAIGN.production.deliverables;
    var inReview = d.filter(function(x) { return x.status === "In Review"; }).length;
    var approved = d.filter(function(x) { return x.status === "Approved"; }).length;

    var header = el("div", "camp-page-header");
    header.innerHTML =
      "<h2 class=\"camp-page-title\">Production</h2>" +
      "<p class=\"camp-page-subtitle\">" + d.length + " deliverables · " + inReview + " in review · " + approved + " approved</p>";
    container.appendChild(header);

    var grid = el("div", "camp-deliverable-grid");
    d.forEach(function(item) {
      var card = el("div", "camp-deliverable-card");
      card.innerHTML =
        "<div class=\"camp-deliverable-card__top\">" +
          "<div class=\"camp-deliverable-card__status\" style=\"color:" + statusColor(item.status) + ";background:" + statusBg(item.status) + "\">" + item.status + "</div>" +
          "<div class=\"camp-deliverable-card__version\">" + item.version + "</div>" +
        "</div>" +
        "<div class=\"camp-deliverable-card__title\">" + item.title + "</div>" +
        "<div class=\"camp-deliverable-card__meta\">" +
          "<span class=\"camp-deliverable-card__platform\">" + item.platform + "</span>" +
          "<span class=\"camp-deliverable-card__owner\">" + item.owner + "</span>" +
        "</div>" +
        "<div class=\"camp-deliverable-card__action\">Open Focus View →</div>";
      card.addEventListener("click", (function(id) {
        return function() { _navigate("production", id); };
      }(item.id)));
      grid.appendChild(card);
    });
    container.appendChild(grid);
  }

  /* ---------- Deliverable Focus ------------------------------------------ */
  function _renderDeliverableFocus(container, focusId) {
    var deliverable = CAMPAIGN.production.deliverables.filter(function(d) { return d.id === focusId; })[0];
    var detail      = DELIVERABLE_DETAIL[focusId] || {};

    if (!deliverable) {
      container.innerHTML = "<p class=\"camp-muted\">Deliverable not found.</p>";
      return;
    }

    // Back button
    var back = el("button", "camp-focus-back", "← Back to Production");
    back.addEventListener("click", function() { _navigate("production"); });
    container.appendChild(back);

    var layout = el("div", "camp-focus-layout");

    /* ---- Main panel ---- */
    var main = el("div", "camp-focus-main");

    // Focus header
    var focusHeader = el("div", "camp-focus-header");
    focusHeader.innerHTML =
      "<div class=\"camp-focus-header__top\">" +
        "<h2 class=\"camp-focus-header__title\">" + deliverable.title + "</h2>" +
        "<div class=\"camp-focus-header__badges\">" +
          "<span class=\"camp-focus-badge\" style=\"color:" + statusColor(deliverable.status) + ";background:" + statusBg(deliverable.status) + "\">" + deliverable.status + "</span>" +
          "<span class=\"camp-focus-badge camp-focus-badge--platform\">" + deliverable.platform + "</span>" +
          "<span class=\"camp-focus-badge camp-focus-badge--version\">" + deliverable.version + "</span>" +
        "</div>" +
      "</div>" +
      "<div class=\"camp-focus-owner\">Owner: <strong>" + deliverable.owner + "</strong></div>";
    main.appendChild(focusHeader);

    // Brief / Caption
    if (detail.bio) {
      var bioCard = el("div", "camp-focus-card");
      bioCard.innerHTML =
        "<div class=\"camp-focus-card__label\">Brief</div>" +
        "<p class=\"camp-focus-card__text\">" + detail.bio + "</p>" +
        (detail.caption
          ? "<div class=\"camp-focus-card__caption\">&ldquo;" + detail.caption + "&rdquo;</div>"
          : "");
      main.appendChild(bioCard);
    }

    // Tasks
    if (detail.tasks && detail.tasks.length) {
      var tasksCard = el("div", "camp-focus-card");
      var taskListHTML = "<div class=\"camp-focus-card__label\">Tasks</div><ul class=\"camp-focus-tasks\">";
      detail.tasks.forEach(function(t) {
        taskListHTML +=
          "<li class=\"camp-focus-task" + (t.done ? " is-done" : "") + "\">" +
            "<span class=\"camp-focus-task__check\">" + (t.done ? "✓" : "○") + "</span>" +
            "<span class=\"camp-focus-task__text\">" + t.text + "</span>" +
          "</li>";
      });
      taskListHTML += "</ul>";
      tasksCard.innerHTML = taskListHTML;
      main.appendChild(tasksCard);
    }

    // Timeline
    if (detail.timeline && detail.timeline.length) {
      var tlCard = el("div", "camp-focus-card");
      var tlHTML = "<div class=\"camp-focus-card__label\">Timeline</div><ul class=\"camp-focus-timeline\">";
      detail.timeline.forEach(function(t, i) {
        var isLast = (i === detail.timeline.length - 1);
        tlHTML +=
          "<li class=\"camp-focus-tl-item\">" +
            "<span class=\"camp-focus-tl-item__date\">" + t.date + "</span>" +
            "<div class=\"camp-focus-tl-item__dot-wrap\">" +
              "<span class=\"camp-focus-tl-item__dot" + (isLast ? " is-last" : "") + "\"></span>" +
              "<span class=\"camp-focus-tl-item__line\"></span>" +
            "</div>" +
            "<span class=\"camp-focus-tl-item__event\">" + t.event + "</span>" +
          "</li>";
      });
      tlHTML += "</ul>";
      tlCard.innerHTML = tlHTML;
      main.appendChild(tlCard);
    }

    // Assets used
    if (detail.assets && detail.assets.length) {
      var assetsCard = el("div", "camp-focus-card");
      var assetsHTML = "<div class=\"camp-focus-card__label\">Assets Used</div><ul class=\"camp-focus-asset-list\">";
      detail.assets.forEach(function(a) {
        assetsHTML += "<li class=\"camp-focus-asset-item\"><span class=\"camp-focus-asset-icon\">📎</span>" + a + "</li>";
      });
      assetsHTML += "</ul>";
      assetsCard.innerHTML = assetsHTML;
      main.appendChild(assetsCard);
    }

    // Feedback
    if (detail.feedback) {
      var fbCard = el("div", "camp-focus-card");
      fbCard.innerHTML =
        "<div class=\"camp-focus-card__label\">Latest Feedback</div>" +
        "<p class=\"camp-focus-card__feedback\">" + detail.feedback + "</p>";
      main.appendChild(fbCard);
    }

    layout.appendChild(main);

    /* ---- Sidebar panel ---- */
    var sidebar = el("div", "camp-focus-sidebar");

    // Media preview placeholder
    var preview = el("div", "camp-focus-preview");
    preview.innerHTML =
      "<div class=\"camp-focus-preview__placeholder\">" +
        "<svg viewBox=\"0 0 40 40\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\">" +
          "<rect x=\"4\" y=\"6\" width=\"32\" height=\"24\" rx=\"3\"/>" +
          "<polygon points=\"16,12 16,22 26,17\" fill=\"currentColor\" stroke=\"none\" opacity=\"0.6\"/>" +
        "</svg>" +
        "<span>Media Preview</span>" +
      "</div>";
    sidebar.appendChild(preview);

    // Analytics
    if (detail.analytics) {
      var analyticsCard = el("div", "camp-focus-analytics");
      analyticsCard.innerHTML =
        "<div class=\"camp-focus-card__label\">Analytics</div>" +
        "<div class=\"camp-focus-analytics__grid\">" +
          "<div class=\"camp-focus-analytics__item\">" +
            "<span class=\"camp-focus-analytics__val\">" + detail.analytics.views + "</span>" +
            "<span class=\"camp-focus-analytics__key\">Views</span>" +
          "</div>" +
          "<div class=\"camp-focus-analytics__item\">" +
            "<span class=\"camp-focus-analytics__val\">" + detail.analytics.engagement + "</span>" +
            "<span class=\"camp-focus-analytics__key\">Engagement</span>" +
          "</div>" +
        "</div>" +
        "<div class=\"camp-focus-analytics__status\">" + detail.analytics.status + "</div>";
      sidebar.appendChild(analyticsCard);
    }

    // Strategy recall button
    var strategyBtn = el("button", "camp-focus-strategy-recall");
    strategyBtn.innerHTML =
      "<svg viewBox=\"0 0 16 16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\">" +
        "<path d=\"M2 4h12M2 8h9M2 12h6\" stroke-linecap=\"round\"/>" +
      "</svg>" +
      "Strategy Brief";
    strategyBtn.addEventListener("click", function() { _navigate("strategy"); });
    sidebar.appendChild(strategyBtn);

    layout.appendChild(sidebar);
    container.appendChild(layout);
  }

  /* ---------- Strategy ---------------------------------------------------- */
  function _renderStrategy(container) {
    var layout = el("div", "camp-strategy-layout");

    /* ---- Main content ---- */
    var main = el("div", "camp-strategy-main");

    var header = el("div", "camp-page-header");
    header.innerHTML =
      "<h2 class=\"camp-page-title\">Strategy</h2>" +
      "<p class=\"camp-page-subtitle\">Campaign reference framework for " + CAMPAIGN.name + "</p>";
    main.appendChild(header);

    var sections = [
      { label: "Campaign Goal",      value: CAMPAIGN.goal          },
      { label: "Target Audience",    value: CAMPAIGN.target + " — " + CAMPAIGN.audience },
      { label: "Geographic Focus",   value: CAMPAIGN.location      },
      { label: "Campaign Objectives",value: CAMPAIGN.campaignGoals },
      { label: "Core Messaging",     value: CAMPAIGN.messaging     }
    ];

    sections.forEach(function(s) {
      var card = el("div", "camp-strategy-card");
      card.innerHTML =
        "<div class=\"camp-strategy-card__label\">" + s.label + "</div>" +
        "<div class=\"camp-strategy-card__value\">" + s.value + "</div>";
      main.appendChild(card);
    });

    // Platforms
    var platCard = el("div", "camp-strategy-card");
    var platTags = CAMPAIGN.platforms.map(function(p) {
      return "<span class=\"camp-strategy-tag\">" + p + "</span>";
    }).join("");
    platCard.innerHTML =
      "<div class=\"camp-strategy-card__label\">Platforms</div>" +
      "<div class=\"camp-strategy-card__tags\">" + platTags + "</div>";
    main.appendChild(platCard);

    layout.appendChild(main);

    /* ---- Campaign Strategy Rail ---- */
    var rail = el("aside", "camp-strategy-rail");
    rail.innerHTML = "<div class=\"camp-strategy-rail__title\">Campaign Strategy</div>";

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
        "<div class=\"camp-strategy-rail__label\">" + f.label + "</div>" +
        "<div class=\"camp-strategy-rail__value\">" + f.value + "</div>";
      rail.appendChild(row);
    });

    layout.appendChild(rail);
    container.appendChild(layout);
  }

  /* ---------- Assets ------------------------------------------------------ */
  function _renderAssets(container) {
    var a      = CAMPAIGN.assets.files;
    var linked = a.filter(function(x) { return x.linked; }).length;

    var header = el("div", "camp-page-header");
    header.innerHTML =
      "<h2 class=\"camp-page-title\">Assets</h2>" +
      "<p class=\"camp-page-subtitle\">" + a.length + " files · " + linked + " linked to deliverables · " + CAMPAIGN.name + "</p>";
    container.appendChild(header);

    // Category summary
    var cats = ["Raw", "Edit", "Thumbnail", "Brand", "Document"];
    var catRow = el("div", "camp-asset-cats");
    cats.forEach(function(c) {
      var count   = a.filter(function(x) { return x.type === c; }).length;
      var catChip = el("div", "camp-asset-cat" + (count === 0 ? " is-empty" : ""));
      catChip.style.setProperty("--c", assetTypeColor(c));
      catChip.innerHTML =
        "<span class=\"camp-asset-cat__label\">" + c + "</span>" +
        "<span class=\"camp-asset-cat__count\">" + count + "</span>";
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
        "<div class=\"camp-asset-item__type\" style=\"color:" + c + ";background:rgba(" + rgb + ",0.1)\">" + file.type + "</div>" +
        "<div class=\"camp-asset-item__name\">" + file.name + "</div>" +
        "<div class=\"camp-asset-item__meta\">" +
          "<span>" + file.size + "</span>" +
          "<span>" + file.date + "</span>" +
          (file.linked ? "<span class=\"camp-asset-item__linked\">Linked</span>" : "") +
        "</div>";
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
  function _renderDelivery(container) {
    var del   = CAMPAIGN.delivery;
    var ready = del.items.filter(function(x) { return x.status === "Ready"; }).length;

    var header = el("div", "camp-page-header");
    header.innerHTML =
      "<h2 class=\"camp-page-title\">Delivery</h2>" +
      "<p class=\"camp-page-subtitle\">" + ready + " ready for export · " + del.readiness + "% campaign package readiness</p>";
    container.appendChild(header);

    // Export readiness bar
    var readinessCard = el("div", "camp-delivery-readiness");
    readinessCard.innerHTML =
      "<div class=\"camp-delivery-readiness__label\">Campaign Package Readiness</div>" +
      "<div class=\"camp-delivery-readiness__bar\">" +
        "<div class=\"camp-delivery-readiness__fill\" style=\"width:" + del.readiness + "%\"></div>" +
      "</div>" +
      "<div class=\"camp-delivery-readiness__pct\">" + del.readiness + "%</div>" +
      "<p class=\"camp-delivery-readiness__notes\">" + del.exportNotes + "</p>";
    container.appendChild(readinessCard);

    // Delivery items
    var list = el("div", "camp-delivery-list");
    del.items.forEach(function(item) {
      var card = el("div", "camp-delivery-item");
      card.innerHTML =
        "<div class=\"camp-delivery-item__top\">" +
          "<span class=\"camp-delivery-item__status\" style=\"color:" + statusColor(item.status) + ";background:" + statusBg(item.status) + "\">" + item.status + "</span>" +
          "<span class=\"camp-delivery-item__platform\">" + item.platform + "</span>" +
        "</div>" +
        "<div class=\"camp-delivery-item__title\">" + item.title + "</div>" +
        "<div class=\"camp-delivery-item__meta\">" +
          "<span class=\"camp-delivery-item__owner\">" + item.owner + "</span>" +
          "<span class=\"camp-delivery-item__notes\">" + item.notes + "</span>" +
        "</div>" +
        (item.status === "Ready" ? "<button class=\"camp-delivery-item__export\">Export →</button>" : "");
      list.appendChild(card);
    });
    container.appendChild(list);
  }

  /* ---------- Entry Point ------------------------------------------------- */
  function render(container) {
    state.section = "overview";
    state.focus   = null;
    _draw(container);
  }

  window.CampaignModule = { render: render };

}());
