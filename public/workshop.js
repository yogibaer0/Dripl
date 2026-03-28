/* ==========================================================================
   AMEBA Workshop Shell — Navigation, Pages & Rail
   ========================================================================== */

(function WorkshopShell() {
  "use strict";

  /* ---------- Placeholder Data (non-campaign) ----------------------------- */
  const MOCK = {
    team: [
      { id: "t1", name: "Sophie M.",  initials: "SM", color: "#a78bfa", status: "Working on strategy deck",    online: "active" },
      { id: "t2", name: "Carlos L.",  initials: "CL", color: "#34d399", status: "Away — back at 3pm",          online: "away"   },
      { id: "t3", name: "Yuki T.",    initials: "YT", color: "#f59e0b", status: "Reviewing deliverable edits", online: "active" }
    ],
    messages: [
      { id: "m1", who: "Sophie M.", initials: "SM", color: "#a78bfa", text: "Can someone check the brand kit folder?" },
      { id: "m2", who: "Yuki T.",   initials: "YT", color: "#f59e0b", text: "New assets uploaded for review."        }
    ],
    blobs: [
      { id: "b1", label: "Try a square crop",       desc: "Hero reel could work as 1:1 for Instagram feed" },
      { id: "b2", label: "Check pending deadlines",  desc: "Some deliverables have upcoming final dates"    }
    ],
    interactions: [
      { id: "i1", who: "Sophie M.", initials: "SM", color: "#a78bfa", type: "comment",  text: "Love the new color direction on slide 4, but can we try a warmer tone?" },
      { id: "i2", who: "Carlos L.", initials: "CL", color: "#34d399", type: "approval", text: "Strategy deck approved. Ready to move to production phase."              },
      { id: "i3", who: "Yuki T.",   initials: "YT", color: "#f59e0b", type: "feedback", text: "The intro hook feels a bit too slow. Consider trimming first 3 seconds."  },
      { id: "i4", who: "Amara K.",  initials: "AK", color: "#f87171", type: "comment",  text: "Can we get higher-res versions of the hero images?"                       }
    ]
  };

  /* ---------- Store shorthand -------------------------------------------- */
  function store() {
    return window.AMEBA && window.AMEBA.storage && window.AMEBA.storage.campaign;
  }

  /* ---------- Helpers ----------------------------------------------------- */
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function avatar(initials, color, size) {
    const s = el("span", "");
    s.style.cssText = `
      display:inline-flex;align-items:center;justify-content:center;
      width:${size||28}px;height:${size||28}px;border-radius:50%;
      background:${color};font-size:${size?(size*0.4):11}px;
      font-weight:700;color:#fff;flex-shrink:0;
    `;
    s.textContent = initials;
    return s;
  }

  /* ---------- Deadline / Date Helpers ------------------------------------ */
  const MONTH_ORDER = {
    "Jan":1,"Feb":2,"Mar":3,"Apr":4,"May":5,"Jun":6,
    "Jul":7,"Aug":8,"Sep":9,"Oct":10,"Nov":11,"Dec":12
  };

  function _dateValue(str) {
    const parts = (str || "").split(" ");
    const month = MONTH_ORDER[parts[0]] || 99;
    const day   = parseInt(parts[1], 10) || 99;
    return month * 100 + day;
  }

  function _urgencyClass(dateStr) {
    const v        = _dateValue(dateStr);
    const now      = new Date();
    const todayVal = (now.getMonth() + 1) * 100 + now.getDate();
    const diff     = v - todayVal;
    if (diff <= 1) return "urgent";
    if (diff <= 5) return "soon";
    return "normal";
  }

  function _deriveDeadlines(deliverables, campaignName) {
    const deadlines = [];
    deliverables.forEach(function (d) {
      const tl = d.timeline || [];
      if (!tl.length) return;
      const last = tl[tl.length - 1];
      deadlines.push({
        deliverableId: d.id,
        name:     d.title,
        event:    last.event,
        date:     last.date,
        status:   d.status,
        platform: d.platform,
        campaign: campaignName
      });
    });
    deadlines.sort((a, b) => _dateValue(a.date) - _dateValue(b.date));
    return deadlines;
  }

  /* ---------- Campaign Metrics ------------------------------------------- */
  function getCampaignMetrics(campaignId) {
    if (!store()) return null;
    const campaign = campaignId
      ? store().getCampaignById(campaignId)
      : store().getActiveCampaign();
    if (!campaign) return null;

    const deliverables = campaign.production.deliverables || [];
    const assets       = campaign.assets.files           || [];

    const total    = deliverables.length;
    const draft    = deliverables.filter(d => d.status === "Draft").length;
    const inProd   = deliverables.filter(d => d.status === "In Production").length;
    const inReview = deliverables.filter(d => d.status === "In Review").length;
    const approved = deliverables.filter(d => d.status === "Approved").length;

    // Linked asset count — derived from deliverable.assetIds (source of truth)
    const linkedIds = new Set();
    deliverables.forEach(d => (d.assetIds || []).forEach(id => linkedIds.add(id)));
    const linkedAssets = linkedIds.size;
    const totalAssets  = assets.length;

    const deliveryItems   = campaign.delivery.items || [];
    const exportReadiness = campaign.delivery.readiness || 0;
    const readyCount      = deliveryItems.filter(i => i.status === "Ready").length;
    const exportNotes     = campaign.delivery.exportNotes || "";

    const deadlines = _deriveDeadlines(deliverables, campaign.name);

    // Derive a human-readable phase label
    let phase = "Production";
    if (inReview > 0 && approved === 0) phase = "In Review";
    else if (inReview > 0) phase = "Review / Delivery";
    else if (approved === total && total > 0) phase = "Complete";

    return {
      campaign,
      total, draft, inProd, inReview, approved,
      linkedAssets, totalAssets,
      exportReadiness, readyCount, exportNotes,
      deadlines, phase
    };
  }

  /* ---------- Workshop Surface State --------------------------------------- */
  const _surfaceState = {
    currentPrompt:        "",
    currentSurfaceResult: null,
    isSurfaceActive:      false
  };

  /* ---------- Prompt Matching --------------------------------------------- */
  function _findCampaignInInput(input, campaigns) {
    for (var i = 0; i < campaigns.length; i++) {
      var c = campaigns[i];
      var nameParts = c.name.toLowerCase().split(/\s+/);
      var meaningful = nameParts.filter(function (p) { return p.length > 3; });
      if (meaningful.some(function (p) { return input.indexOf(p) !== -1; })) return c;
    }
    return null;
  }

  function _matchPrompt(rawInput) {
    var input = rawInput.toLowerCase().trim();
    if (!input) return null;

    var campaigns = store() ? store().getCampaigns() : [];
    var matched;

    // Analytics — most specific, check first
    if (input.indexOf("analytics") !== -1) {
      matched = _findCampaignInInput(input, campaigns) || (store() ? store().getActiveCampaign() : null);
      return { type: "analytics", campaign: matched };
    }

    // Company / client info
    if (input.indexOf("company") !== -1 || input.indexOf("client info") !== -1 || input.indexOf("brand info") !== -1) {
      matched = _findCampaignInInput(input, campaigns) || (store() ? store().getActiveCampaign() : null);
      return { type: "company", campaign: matched };
    }

    // Campaign surface (generic "campaign" keyword or a campaign name match)
    var nameMatch = _findCampaignInInput(input, campaigns);
    if (input.indexOf("campaign") !== -1 || nameMatch) {
      matched = nameMatch || (store() ? store().getActiveCampaign() : null);
      return { type: "campaign", campaign: matched };
    }

    return null;
  }

  /* ---------- Data Availability Checks ------------------------------------- */
  function _hasRealAnalytics(campaign) {
    if (!campaign) return false;
    var deliverables = (campaign.production && campaign.production.deliverables) || [];
    return deliverables.some(function (d) {
      return d.analytics && d.analytics.views && d.analytics.views !== "\u2014";
    });
  }

  function _hasDeliverables(campaign) {
    return !!(campaign && campaign.production && campaign.production.deliverables &&
              campaign.production.deliverables.length > 0);
  }

  function _hasDelivery(campaign) {
    return !!(campaign && campaign.delivery && campaign.delivery.items &&
              campaign.delivery.items.length > 0 && campaign.delivery.readiness > 0);
  }

  function _hasPlatforms(campaign) {
    return !!(campaign && campaign.platforms && campaign.platforms.length > 0);
  }

  function _hasRelevantComments() {
    return MOCK.interactions.filter(function (i) {
      return i.type === "comment" || i.type === "feedback";
    }).length > 0;
  }

  /* ---------- Surface Stat Chip Helper ------------------------------------- */
  function _makeStatChip(val, lbl) {
    var chip = el("div", "ws-pf-stat-chip");
    chip.appendChild(el("span", "ws-pf-stat-chip__val", val));
    chip.appendChild(el("span", "ws-pf-stat-chip__lbl", lbl));
    return chip;
  }

  /* ---------- Surface Clear Handler --------------------------------------- */
  function _clearSurface() {
    _surfaceState.isSurfaceActive     = false;
    _surfaceState.currentSurfaceResult = null;
    _surfaceState.currentPrompt        = "";
    var wsContainer = document.getElementById("pageWorkshop");
    if (wsContainer) {
      renderWorkshop(wsContainer);
      wsContainer.dataset.rendered = "1";
    }
  }

  /* ---------- Primary Frame Builders --------------------------------------- */
  function _buildCampaignPrimaryFrame(frame, campaign) {
    var metrics = getCampaignMetrics(campaign ? campaign.id : null);
    if (!campaign || !metrics) {
      frame.appendChild(el("p", "ws-pf-empty", "No campaign data available."));
      return;
    }

    frame.appendChild(el("div", "ws-pf-label", "Campaign"));
    frame.appendChild(el("div", "ws-pf-title", campaign.name));

    var meta = el("div", "ws-pf-meta");
    meta.textContent = campaign.client + " \u00b7 " + campaign.type;
    frame.appendChild(meta);

    var phaseRow = el("div", "ws-pf-phase-row");
    phaseRow.appendChild(el("span", "ws-pf-phase-badge", metrics.phase));
    if (campaign.duration) {
      phaseRow.appendChild(el("span", "ws-pf-duration", campaign.duration));
    }
    frame.appendChild(phaseRow);

    if (campaign.goal) {
      var goalRow = el("div", "ws-pf-field");
      goalRow.appendChild(el("span", "ws-pf-field__label", "Goal"));
      goalRow.appendChild(el("span", "ws-pf-field__val", campaign.goal));
      frame.appendChild(goalRow);
    }

    if (_hasPlatforms(campaign)) {
      var platRow = el("div", "ws-pf-platforms");
      campaign.platforms.forEach(function (p) {
        platRow.appendChild(el("span", "ws-pf-platform-pill", p));
      });
      frame.appendChild(platRow);
    }

    var statsRow = el("div", "ws-pf-stats-row");
    statsRow.appendChild(_makeStatChip(String(metrics.total),    "deliverables"));
    statsRow.appendChild(_makeStatChip(String(metrics.inReview), "in review"));
    statsRow.appendChild(_makeStatChip(String(metrics.approved), "approved"));
    frame.appendChild(statsRow);

    var action = el("button", "ws-pf-action", "Open Campaign \u2192");
    action.addEventListener("click", function () {
      window.AMEBA && window.AMEBA.navigateToPage && window.AMEBA.navigateToPage("campaign");
    });
    frame.appendChild(action);
  }

  function _buildCompanyPrimaryFrame(frame, campaign) {
    if (!campaign) {
      frame.appendChild(el("p", "ws-pf-empty", "No client data available."));
      return;
    }

    frame.appendChild(el("div", "ws-pf-label", "Client / Company"));
    frame.appendChild(el("div", "ws-pf-title", campaign.client));

    var meta = el("div", "ws-pf-meta");
    meta.textContent = "For: " + campaign.name;
    frame.appendChild(meta);

    if (campaign.campaignGoals) {
      var gRow = el("div", "ws-pf-field");
      gRow.appendChild(el("span", "ws-pf-field__label", "Goals"));
      gRow.appendChild(el("span", "ws-pf-field__val", campaign.campaignGoals));
      frame.appendChild(gRow);
    }

    if (campaign.audience) {
      var aRow = el("div", "ws-pf-field");
      aRow.appendChild(el("span", "ws-pf-field__label", "Audience"));
      aRow.appendChild(el("span", "ws-pf-field__val", campaign.audience));
      frame.appendChild(aRow);
    }

    if (campaign.location) {
      var lRow = el("div", "ws-pf-field");
      lRow.appendChild(el("span", "ws-pf-field__label", "Location"));
      lRow.appendChild(el("span", "ws-pf-field__val", campaign.location));
      frame.appendChild(lRow);
    }

    if (campaign.messaging) {
      var mRow = el("div", "ws-pf-field");
      mRow.appendChild(el("span", "ws-pf-field__label", "Messaging"));
      mRow.appendChild(el("span", "ws-pf-field__val ws-pf-field__val--italic", campaign.messaging));
      frame.appendChild(mRow);
    }
  }

  function _buildAnalyticsPrimaryFrame(frame, campaign) {
    var metrics = getCampaignMetrics(campaign ? campaign.id : null);
    if (!campaign || !metrics) {
      frame.appendChild(el("p", "ws-pf-empty", "No campaign data available."));
      return;
    }

    frame.appendChild(el("div", "ws-pf-label", "Analytics"));
    frame.appendChild(el("div", "ws-pf-title", campaign.name));

    // Performance data availability notice
    var hasReal = _hasRealAnalytics(campaign);
    var notice = el("div", hasReal ? "ws-pf-analytics-notice ws-pf-analytics-notice--ok" : "ws-pf-analytics-notice");
    notice.textContent = hasReal
      ? "Performance data available."
      : "\u26a0 Not enough performance data yet. Showing delivery readiness instead.";
    frame.appendChild(notice);

    // Delivery readiness (always shown if meaningful)
    if (_hasDelivery(campaign)) {
      var readRow = el("div", "ws-pf-readiness");
      readRow.appendChild(el("span", "ws-pf-field__label", "Delivery readiness"));
      var readVal = el("span", "ws-pf-readiness__val", metrics.exportReadiness + "%");
      readRow.appendChild(readVal);
      frame.appendChild(readRow);

      var bar = el("div", "ws-pf-readiness-bar");
      var fill = el("div", "ws-pf-readiness-bar__fill");
      fill.style.width = metrics.exportReadiness + "%";
      bar.appendChild(fill);
      frame.appendChild(bar);

      if (metrics.exportNotes) {
        var notes = el("div", "ws-pf-delivery-notes", metrics.exportNotes);
        frame.appendChild(notes);
      }
    }

    var statsRow = el("div", "ws-pf-stats-row");
    statsRow.appendChild(_makeStatChip(String(metrics.readyCount), "ready"));
    statsRow.appendChild(_makeStatChip(String(metrics.inReview),   "in review"));
    statsRow.appendChild(_makeStatChip(String(metrics.approved),   "approved"));
    frame.appendChild(statsRow);
  }

  /* ---------- Child Frame Builders ---------------------------------------- */
  function _makeChildFrame(title) {
    var frame = el("div", "ws-child-frame");
    frame.appendChild(el("div", "ws-child-frame__title", title));
    return frame;
  }

  function _buildDeliverablesChild(campaign, metrics) {
    var frame = _makeChildFrame("Deliverables");
    var body  = el("div", "ws-child-frame__body");
    var deliverables = campaign.production.deliverables;

    var pillsRow = el("div", "ws-cf-pills");
    if (metrics.draft)    pillsRow.appendChild(el("span", "ws-cf-pill ws-cf-pill--draft",   metrics.draft    + " Draft"));
    if (metrics.inProd)   pillsRow.appendChild(el("span", "ws-cf-pill ws-cf-pill--inprod",  metrics.inProd   + " In Prod"));
    if (metrics.inReview) pillsRow.appendChild(el("span", "ws-cf-pill ws-cf-pill--review",  metrics.inReview + " Review"));
    if (metrics.approved) pillsRow.appendChild(el("span", "ws-cf-pill ws-cf-pill--approved", metrics.approved + " Approved"));
    body.appendChild(pillsRow);

    // List top 3 deliverables by activity
    var active = deliverables.filter(function (d) { return d.status !== "Approved"; }).slice(0, 3);
    active.forEach(function (d) {
      var row = el("div", "ws-cf-row");
      row.appendChild(el("span", "ws-cf-row__name", d.title));
      row.appendChild(el("span", "ws-cf-row__status ws-cf-row__status--" + d.status.replace(/\s+/g, "").toLowerCase(), d.status));
      body.appendChild(row);
    });

    frame.appendChild(body);
    return frame;
  }

  function _buildDeliveryChild(campaign, metrics) {
    var frame = _makeChildFrame("Delivery");
    var body  = el("div", "ws-child-frame__body");

    var readRow = el("div", "ws-cf-readiness");
    readRow.appendChild(el("span", "ws-cf-readiness__val", metrics.exportReadiness + "%"));
    readRow.appendChild(el("span", "ws-cf-readiness__lbl", "ready"));
    body.appendChild(readRow);

    var bar  = el("div", "ws-cf-bar");
    var fill = el("div", "ws-cf-bar__fill");
    fill.style.width = metrics.exportReadiness + "%";
    bar.appendChild(fill);
    body.appendChild(bar);

    campaign.delivery.items.slice(0, 3).forEach(function (item) {
      var row = el("div", "ws-cf-row");
      row.appendChild(el("span", "ws-cf-row__name", item.title));
      var statusClass = item.status === "Ready" ? "ws-cf-row__status--approved" : "ws-cf-row__status--review";
      row.appendChild(el("span", "ws-cf-row__status " + statusClass, item.status));
      body.appendChild(row);
    });

    frame.appendChild(body);
    return frame;
  }

  function _buildPlatformsChild(campaign) {
    var frame = _makeChildFrame("Platforms");
    var body  = el("div", "ws-child-frame__body");
    var pills = el("div", "ws-cf-pills");
    campaign.platforms.forEach(function (p) {
      pills.appendChild(el("span", "ws-cf-pill ws-cf-pill--platform", p));
    });
    body.appendChild(pills);

    if (campaign.target) {
      var tRow = el("div", "ws-cf-subtext", campaign.target);
      body.appendChild(tRow);
    }

    frame.appendChild(body);
    return frame;
  }

  function _buildCampaignContextChild(campaign, metrics) {
    var frame = _makeChildFrame("Campaign");
    var body  = el("div", "ws-child-frame__body");

    body.appendChild(el("div", "ws-cf-name", campaign.name));
    if (metrics) {
      body.appendChild(el("div", "ws-cf-subtext", metrics.phase + " \u00b7 " + metrics.total + " deliverables"));
    }

    frame.appendChild(body);
    return frame;
  }

  function _buildCommentsChild(comments) {
    var frame = _makeChildFrame("Recent Feedback");
    var body  = el("div", "ws-child-frame__body");
    comments.slice(0, 2).forEach(function (i) {
      var row = el("div", "ws-cf-comment");
      row.appendChild(el("span", "ws-cf-comment__who", i.who));
      row.appendChild(el("span", "ws-cf-comment__text", i.text));
      body.appendChild(row);
    });
    frame.appendChild(body);
    return frame;
  }

  function _buildDeliveryItemsChild(campaign, metrics) {
    var frame = _makeChildFrame("Delivery Items");
    var body  = el("div", "ws-child-frame__body");
    campaign.delivery.items.slice(0, 3).forEach(function (item) {
      var row = el("div", "ws-cf-row");
      row.appendChild(el("span", "ws-cf-row__name", item.title));
      var statusClass = item.status === "Ready" ? "ws-cf-row__status--approved" : "ws-cf-row__status--review";
      row.appendChild(el("span", "ws-cf-row__status " + statusClass, item.status));
      body.appendChild(row);
    });
    frame.appendChild(body);
    return frame;
  }

  function _buildStatusSummaryChild(campaign, metrics) {
    var frame = _makeChildFrame("Status");
    var body  = el("div", "ws-child-frame__body");
    var pills = el("div", "ws-cf-pills");
    if (metrics.draft)    pills.appendChild(el("span", "ws-cf-pill ws-cf-pill--draft",    metrics.draft    + " Draft"));
    if (metrics.inProd)   pills.appendChild(el("span", "ws-cf-pill ws-cf-pill--inprod",   metrics.inProd   + " In Prod"));
    if (metrics.inReview) pills.appendChild(el("span", "ws-cf-pill ws-cf-pill--review",   metrics.inReview + " Review"));
    if (metrics.approved) pills.appendChild(el("span", "ws-cf-pill ws-cf-pill--approved", metrics.approved + " Approved"));
    body.appendChild(pills);
    frame.appendChild(body);
    return frame;
  }

  /* ---------- Surface Area Orchestrator ------------------------------------ */
  function _renderSurfaceArea(result) {
    var type     = result.type;
    var campaign = result.campaign;
    var metrics  = campaign ? getCampaignMetrics(campaign.id) : null;

    var wrap = el("div", "ws-surface-area");

    /* -- Primary frame -- */
    var primary = el("div", "ws-primary-frame");

    var closeBtn = el("button", "ws-surface-close", "\u00d7");
    closeBtn.setAttribute("aria-label", "Clear surfaced result");
    closeBtn.addEventListener("click", _clearSurface);
    primary.appendChild(closeBtn);

    if (type === "campaign")  _buildCampaignPrimaryFrame(primary, campaign);
    if (type === "company")   _buildCompanyPrimaryFrame(primary, campaign);
    if (type === "analytics") _buildAnalyticsPrimaryFrame(primary, campaign);

    wrap.appendChild(primary);

    /* -- Child frames -- */
    var childWrap = el("div", "ws-child-frames");
    var childCount = 0;

    if (type === "campaign") {
      if (_hasDeliverables(campaign) && childCount < 3) {
        childWrap.appendChild(_buildDeliverablesChild(campaign, metrics));
        childCount++;
      }
      if (_hasDelivery(campaign) && childCount < 3) {
        childWrap.appendChild(_buildDeliveryChild(campaign, metrics));
        childCount++;
      }
    } else if (type === "company") {
      if (_hasPlatforms(campaign) && childCount < 3) {
        childWrap.appendChild(_buildPlatformsChild(campaign));
        childCount++;
      }
      if (campaign && childCount < 3) {
        childWrap.appendChild(_buildCampaignContextChild(campaign, metrics));
        childCount++;
      }
      if (_hasRelevantComments() && childCount < 3) {
        var relevant = MOCK.interactions.filter(function (i) {
          return i.type === "comment" || i.type === "feedback";
        });
        childWrap.appendChild(_buildCommentsChild(relevant));
        childCount++;
      }
    } else if (type === "analytics") {
      if (_hasDelivery(campaign) && childCount < 3) {
        childWrap.appendChild(_buildDeliveryItemsChild(campaign, metrics));
        childCount++;
      }
      if (_hasDeliverables(campaign) && childCount < 3) {
        childWrap.appendChild(_buildStatusSummaryChild(campaign, metrics));
        childCount++;
      }
    }

    if (childCount > 0) wrap.appendChild(childWrap);

    return wrap;
  }

  /* ---------- Workshop State ---------------------------------------------- */
  let _calendarExpanded   = false;
  const _acknowledgedEphemeral = {};  // id -> true

  /* ---------- Calendar / Date Helpers ------------------------------------- */
  const DAYS_SHORT  = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTHS_FULL = ["January", "February", "March", "April", "May", "June",
                       "July", "August", "September", "October", "November", "December"];

  function _getCurrentWeekDays() {
    const today   = new Date();
    const dow     = today.getDay();                    // 0 = Sun
    const monday  = new Date(today);
    monday.setDate(today.getDate() - ((dow + 6) % 7)); // back to Monday
    const week = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      week.push(d);
    }
    return week;
  }

  function _getMonthDays(year, month) {
    const firstDay    = new Date(year, month, 1);
    const lastDay     = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7;   // Monday-start
    const days        = [];
    for (let i = startOffset - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month, -i), currentMonth: false });
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ date: new Date(year, month, d), currentMonth: true });
    }
    const trailing = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= trailing; i++) {
      days.push({ date: new Date(year, month + 1, i), currentMonth: false });
    }
    return days;
  }

  function _deadlineDayMap(deadlines) {
    const map = {};
    deadlines.forEach(function (d) {
      const parts    = (d.date || "").split(" ");
      const monthIdx = MONTH_ORDER[parts[0]];
      const dayNum   = parseInt(parts[1], 10);
      if (!monthIdx || isNaN(dayNum)) return;
      const year = new Date().getFullYear();
      const key  = year + "-" + monthIdx + "-" + dayNum;
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    return map;
  }

  /* ---------- Workshop Page ----------------------------------------------- */
  function renderWorkshop(container) {
    container.innerHTML = "";

    const metrics = getCampaignMetrics();

    // Minimal Workshop page title
    container.appendChild(el("h1", "ws-page-title", "Workshop"));

    const layout = el("div", "ws-layout");
    container.appendChild(layout);

    // 1 — Team circles (top-right of main content area)
    const teamAnchor = el("div", "ws-team-anchor");
    teamAnchor.appendChild(renderTeamCircles());
    layout.appendChild(teamAnchor);

    // 2 — Campaigns anchor card (right column)
    const campaignsAnchor = el("div", "ws-campaigns-anchor");
    campaignsAnchor.appendChild(renderCampaignsAnchorCard(container));
    layout.appendChild(campaignsAnchor);

    // 3 — Center area: surface result or open breathing space
    if (_surfaceState.isSurfaceActive && _surfaceState.currentSurfaceResult) {
      layout.appendChild(_renderSurfaceArea(_surfaceState.currentSurfaceResult));
    } else {
      layout.appendChild(el("div", "ws-open-space"));
    }

    // 4 — Bottom section: calendar, tasks, ephemeral
    const bottomSection = el("div", "ws-bottom-section");
    layout.appendChild(bottomSection);

    bottomSection.appendChild(renderCalendarAnchor(metrics));

    if (metrics) {
      const tasksEl = renderTasksArea(metrics);
      if (tasksEl) bottomSection.appendChild(tasksEl);
    }

    const ephemeralEl = renderEphemeralContainers();
    if (ephemeralEl) bottomSection.appendChild(ephemeralEl);
  }

  /* ---------- Team Circles (top-right anchor) ----------------------------- */
  function renderTeamCircles() {
    const wrap = el("div", "ws-team-circles");
    MOCK.team.forEach(function (t) {
      const circle = el("div", "ws-team-circle");
      circle.style.background = t.color;
      circle.textContent = t.initials;
      circle.title = t.name + " \u2014 " + t.status;
      circle.setAttribute("aria-label", t.name + ", " + t.online + " \u2014 " + t.status);
      const dot = el("span", "ws-team-circle__status ws-team-circle__status--" + t.online);
      circle.appendChild(dot);
      wrap.appendChild(circle);
    });
    return wrap;
  }

  /* ---------- Campaigns Anchor Card (right column) ------------------------ */
  function renderCampaignsAnchorCard(workshopContainer) {
    const campaigns        = store() ? store().getCampaigns()        : [];
    const activeCampaignId = store() ? store().getActiveCampaignId() : null;

    const card = el("div", "ws-campaigns-card");
    card.appendChild(el("div", "ws-campaigns-card__title", "Campaigns"));

    campaigns.forEach(function (c) {
      const isActive = c.id === activeCampaignId;
      const m        = getCampaignMetrics(c.id);
      const phase    = m ? m.phase : "\u2014";

      const item     = el("div", "ws-camp-item" + (isActive ? " ws-camp-item--active" : ""));
      const nameEl   = el("div", "ws-camp-item__name", c.name);
      const clientEl = el("div", "ws-camp-item__client", c.client);

      const phaseRow = el("div", "ws-camp-item__phase");
      phaseRow.appendChild(el("span", "ws-camp-item__phase-dot"));
      phaseRow.appendChild(document.createTextNode(phase));

      item.appendChild(nameEl);
      item.appendChild(clientEl);
      item.appendChild(phaseRow);

      item.addEventListener("click", function () {
        if (isActive) {
          window.AMEBA && window.AMEBA.navigateToPage && window.AMEBA.navigateToPage("campaign");
        } else {
          window.AMEBA && window.AMEBA.setActiveCampaign && window.AMEBA.setActiveCampaign(c.id);
        }
      });

      card.appendChild(item);
    });

    return card;
  }

  /* ---------- Calendar Anchor (bottom-left) ------------------------------- */
  function renderCalendarAnchor(metrics) {
    const deadlines   = (metrics && metrics.deadlines) || [];
    const deadlineMap = _deadlineDayMap(deadlines);
    const today       = new Date();
    const weekDays    = _getCurrentWeekDays();

    const wrapper = el("div", "ws-cal");

    /* -- Compact week strip -- */
    const compact = el("div", "ws-cal__compact");
    compact.setAttribute("role", "button");
    compact.setAttribute("aria-expanded", String(_calendarExpanded));
    compact.tabIndex = 0;

    compact.appendChild(el("span", "ws-cal__month-label", MONTHS_FULL[today.getMonth()]));

    const weekStrip = el("div", "ws-cal__week-strip");
    weekDays.forEach(function (d) {
      const isToday = d.toDateString() === today.toDateString();
      const dayEl   = el("div", "ws-cal__day" + (isToday ? " ws-cal__day--today" : ""));
      dayEl.appendChild(el("span", "ws-cal__day__label", DAYS_SHORT[d.getDay()]));
      dayEl.appendChild(el("span", "ws-cal__day__num",   String(d.getDate())));
      const mIdx = d.getMonth() + 1;
      const key  = d.getFullYear() + "-" + mIdx + "-" + d.getDate();
      if (deadlineMap[key]) dayEl.appendChild(el("span", "ws-cal__day__dot"));
      weekStrip.appendChild(dayEl);
    });
    compact.appendChild(weekStrip);

    const expandIcon = el("span", "ws-cal__expand-icon", _calendarExpanded ? "\u2191" : "\u2193");
    compact.appendChild(expandIcon);
    wrapper.appendChild(compact);

    /* -- Expanded month grid -- */
    const expanded = el("div", "ws-cal__expanded");
    expanded.hidden = !_calendarExpanded;

    const expHeader = el("div", "ws-cal__expanded-header");
    expHeader.appendChild(el("span", "ws-cal__month-label",
      MONTHS_FULL[today.getMonth()] + " " + today.getFullYear()));
    expanded.appendChild(expHeader);

    const grid = el("div", "ws-cal__grid");
    ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].forEach(function (d) {
      grid.appendChild(el("div", "ws-cal__grid-header", d));
    });

    _getMonthDays(today.getFullYear(), today.getMonth()).forEach(function (entry) {
      const date         = entry.date;
      const currentMonth = entry.currentMonth;
      const isToday      = date.toDateString() === today.toDateString();
      const mIdx         = date.getMonth() + 1;
      const key          = date.getFullYear() + "-" + mIdx + "-" + date.getDate();
      const hasDeadline  = !!deadlineMap[key];
      const urgency      = hasDeadline ? _urgencyClass((deadlineMap[key][0] || {}).date) : null;

      let cls = "ws-cal__grid-day";
      if (isToday)       cls += " ws-cal__grid-day--today";
      if (!currentMonth) cls += " ws-cal__grid-day--other";
      if (hasDeadline)   cls += " ws-cal__grid-day--has-deadline";
      if (urgency === "urgent") cls += " is-urgent";

      grid.appendChild(el("div", cls, String(date.getDate())));
    });
    expanded.appendChild(grid);

    if (deadlines.length) {
      const dlSection = el("div", "ws-cal__deadline-list");
      deadlines.slice(0, 6).forEach(function (d) {
        const urgency = _urgencyClass(d.date);
        const item    = el("div", "ws-cal__deadline-item");
        item.appendChild(el("span", "ws-cal__deadline-name", d.name));
        const dateSpan = el("span",
          "ws-cal__deadline-date" + (urgency !== "normal" ? " is-urgent" : ""), d.date);
        item.appendChild(dateSpan);
        item.style.cursor = "pointer";
        item.addEventListener("click", function () {
          window.AMEBA && window.AMEBA.openDeliverableFocus &&
            window.AMEBA.openDeliverableFocus(d.deliverableId);
        });
        dlSection.appendChild(item);
      });
      expanded.appendChild(dlSection);
    }

    wrapper.appendChild(expanded);

    function toggleCal(e) {
      e.stopPropagation();
      _calendarExpanded = !_calendarExpanded;
      expanded.hidden   = !_calendarExpanded;
      expandIcon.textContent = _calendarExpanded ? "\u2191" : "\u2193";
      compact.setAttribute("aria-expanded", String(_calendarExpanded));
    }
    compact.addEventListener("click", toggleCal);
    compact.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleCal(e); }
    });

    return wrapper;
  }

  /* ---------- Tasks Area (beneath calendar) ------------------------------- */
  function renderTasksArea(metrics) {
    if (!metrics) return null;
    const deliverables = metrics.campaign.production.deliverables || [];

    const tasks = [];
    deliverables.forEach(function (d) {
      if (d.status === "Approved") return;
      (d.tasks || []).forEach(function (t) {
        if (!t.done) {
          tasks.push({ id: t.id + "-" + d.id, text: t.text, source: d.title });
        }
      });
    });

    if (!tasks.length) return null;

    const wrapper = el("div", "ws-tasks");
    wrapper.appendChild(el("div", "ws-tasks__label", "To Do"));

    tasks.slice(0, 6).forEach(function (t) {
      const item   = el("div", "ws-task-item");
      const check  = el("span", "ws-task-item__check");
      const text   = el("span", "ws-task-item__text", t.text);
      const source = el("span", "ws-task-item__source", t.source);

      item.appendChild(check);
      item.appendChild(text);
      item.appendChild(source);
      wrapper.appendChild(item);

      check.addEventListener("click", function () {
        const done = item.classList.toggle("ws-task-item--done");
        check.classList.toggle("ws-task-item__check--done", done);
        check.textContent = done ? "\u2713" : "";
      });
    });

    return wrapper;
  }

  /* ---------- Ephemeral Containers ---------------------------------------- */
  function renderEphemeralContainers() {
    const visible = MOCK.interactions.filter(function (i) {
      return !_acknowledgedEphemeral[i.id];
    });
    if (!visible.length) return null;

    const wrapper = el("div", "ws-ephemeral");
    wrapper.appendChild(el("div", "ws-tasks__label", "New"));

    visible.forEach(function (i) {
      const ctr = el("div", "ws-ephemeral-container");
      ctr.dataset.ephemeralId = i.id;

      ctr.appendChild(avatar(i.initials, i.color, 28));

      const body = el("div", "ws-ephemeral-container__body");
      const who  = el("div", "ws-ephemeral-container__who");
      who.appendChild(document.createTextNode(i.who + " "));
      who.appendChild(el("span", "ws-ephemeral-container__type", i.type));
      const text = el("div", "ws-ephemeral-container__text", i.text);
      body.appendChild(who);
      body.appendChild(text);
      ctr.appendChild(body);

      const dismiss = el("button", "ws-ephemeral-container__dismiss", "\u00d7");
      dismiss.setAttribute("aria-label", "Dismiss note from " + i.who);
      dismiss.addEventListener("click", function (e) {
        e.stopPropagation();
        _acknowledgedEphemeral[i.id] = true;
        ctr.classList.add("is-dismissing");
        setTimeout(function () {
          ctr.remove();
          if (!wrapper.querySelector(".ws-ephemeral-container")) wrapper.remove();
        }, 220);
      });
      ctr.appendChild(dismiss);

      wrapper.appendChild(ctr);
    });

    return wrapper;
  }


    /* ---------- Campaign Page ---------------------------------------------- */
  function renderCampaign(container) {
    if (window.CampaignModule) {
      window.CampaignModule.render(container);
    } else {
      container.innerHTML = '<p style="color:#6060a0;padding:24px">Campaign module loading\u2026</p>';
    }
  }

  /* ---------- Supply Page ------------------------------------------------ */
  function renderSupply(container) {
    if (window.SupplyModule) {
      window.SupplyModule.render(container);
    } else {
      container.innerHTML = '<p style="color:#6060a0;padding:24px">Supply module loading\u2026</p>';
    }
  }

  /* ---------- Ameba Rail -------------------------------------------------- */
  function renderRail(rail) {
    rail.innerHTML = "";

    const metrics = getCampaignMetrics();

    /* ── Zone 1: Prompt input ─────────────────────────────────────────────── */
    const promptZone = el("div", "rail-prompt-zone");

    const promptLabel = el("div", "rail-prompt-zone__label", "Ask Ameba");
    promptZone.appendChild(promptLabel);

    const promptRow = el("div", "rail-prompt-zone__row");
    const promptInput = el("input", "rail-prompt__input");
    promptInput.type = "text";
    promptInput.placeholder = "e.g. pull up summer campaign";
    promptInput.setAttribute("aria-label", "Prompt Ameba");

    const promptBtn = el("button", "rail-prompt__btn", "\u2192");
    promptBtn.setAttribute("aria-label", "Submit prompt");

    function doPrompt() {
      const val = promptInput.value.trim();
      if (!val) return;
      const result = _matchPrompt(val);
      if (result && result.campaign) {
        _surfaceState.currentPrompt        = val;
        _surfaceState.currentSurfaceResult = result;
        _surfaceState.isSurfaceActive      = true;
        promptInput.value = "";
        promptInput.classList.remove("is-no-match");
        // Re-render workshop center
        const wsContainer = document.getElementById("pageWorkshop");
        if (wsContainer) {
          renderWorkshop(wsContainer);
          wsContainer.dataset.rendered = "1";
        }
        // Update rail prompt hint
        const hint = promptZone.querySelector(".rail-prompt__hint");
        if (hint) {
          hint.textContent = "\u2713 " + val;
          hint.className = "rail-prompt__hint rail-prompt__hint--active";
        }
      } else {
        promptInput.classList.add("is-no-match");
        const prevPlaceholder = promptInput.placeholder;
        promptInput.placeholder = "No result \u2014 try again";
        promptInput.value = "";
        setTimeout(function () {
          promptInput.classList.remove("is-no-match");
          promptInput.placeholder = "e.g. pull up summer campaign";
        }, 2200);
      }
    }

    promptBtn.addEventListener("click", doPrompt);
    promptInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") doPrompt();
    });

    promptRow.appendChild(promptInput);
    promptRow.appendChild(promptBtn);
    promptZone.appendChild(promptRow);

    // Show active surface hint + clear link
    const promptHint = el("div", "rail-prompt__hint", "");
    if (_surfaceState.isSurfaceActive && _surfaceState.currentPrompt) {
      promptHint.textContent = "\u2713 " + _surfaceState.currentPrompt;
      promptHint.className = "rail-prompt__hint rail-prompt__hint--active";
      const clearLink = el("span", "rail-prompt__hint-clear", "clear");
      clearLink.addEventListener("click", _clearSurface);
      promptHint.appendChild(clearLink);
    }
    promptZone.appendChild(promptHint);

    rail.appendChild(promptZone);

    /* ── Zone 2: Context modules (scrollable middle content) ──────────────── */
    const middleZone = el("div", "rail-middle-zone");

    // 2a. Team online
    const teamMod = el("section", "rail-module");
    teamMod.innerHTML = `<h2 class="rail-module__title">Team Online</h2>`;
    const teamList = el("ul", "rail-module__list");
    MOCK.team.forEach(t => {
      const li = el("li", "rail-team-member");
      li.appendChild(avatar(t.initials, t.color, 28));
      const name = el("span", "rail-team-member__name", t.name);
      const dot  = el("span", "rail-team-member__status");
      dot.style.background = t.online === "active" ? "#4ade80" : (t.online === "away" ? "#f59e0b" : "#f87171");
      li.appendChild(name);
      li.appendChild(dot);
      teamList.appendChild(li);
    });
    teamMod.appendChild(teamList);
    middleZone.appendChild(teamMod);

    // 2b. Active campaign (real data)
    const campMod = el("section", "rail-module");
    campMod.innerHTML = `<h2 class="rail-module__title">Active Campaign</h2>`;
    const campList = el("ul", "rail-module__list");
    if (metrics) {
      const { campaign, phase, total, inReview } = metrics;
      const li = el("li", "rail-campaign-row rail-campaign-row--clickable");
      li.innerHTML =
        `<span class="rail-campaign-row__name">${campaign.name}</span>` +
        `<span class="rail-campaign-row__meta">${campaign.client} \u00b7 ${phase}</span>` +
        `<span class="rail-campaign-row__stats">${total} deliverables \u00b7 ${inReview} in review</span>`;
      li.addEventListener("click", () => {
        window.AMEBA && window.AMEBA.navigateToPage && window.AMEBA.navigateToPage("campaign");
      });
      campList.appendChild(li);

      // Show other campaigns as switch targets
      const allCampaigns = store() ? store().getCampaigns() : [];
      const activeCampaignId = store() ? store().getActiveCampaignId() : null;
      allCampaigns.forEach(c => {
        if (c.id === activeCampaignId) return;
        const switchLi = el("li", "rail-campaign-row rail-campaign-row--other rail-campaign-row--clickable");
        switchLi.innerHTML =
          `<span class="rail-campaign-row__name">${c.name}</span>` +
          `<span class="rail-campaign-row__meta">${c.client} \u00b7 ${c.type}</span>`;
        switchLi.addEventListener("click", () => {
          window.AMEBA && window.AMEBA.setActiveCampaign && window.AMEBA.setActiveCampaign(c.id);
          const wsContainer = document.getElementById("pageWorkshop");
          if (wsContainer) { renderWorkshop(wsContainer); wsContainer.dataset.rendered = "1"; }
          renderRail(rail);
        });
        campList.appendChild(switchLi);
      });
    } else {
      const li = el("li", "rail-campaign-row");
      li.innerHTML = `<span class="rail-campaign-row__meta">No campaign data</span>`;
      campList.appendChild(li);
    }
    campMod.appendChild(campList);
    middleZone.appendChild(campMod);

    // 2c. Upcoming deadlines (real data)
    const dlMod = el("section", "rail-module");
    dlMod.innerHTML = `<h2 class="rail-module__title">Upcoming Deadlines</h2>`;
    const dlList = el("ul", "rail-module__list");
    const deadlines = metrics ? metrics.deadlines : [];
    deadlines.slice(0, 4).forEach(d => {
      const urgency = _urgencyClass(d.date);
      const li = el("li", "rail-deadline-row rail-deadline-row--clickable");
      li.innerHTML =
        `<span class="rail-deadline-row__name">${d.name}</span>` +
        `<span class="rail-deadline-row__date ${urgency !== 'normal' ? 'is-soon' : ''}">${d.date}</span>`;
      li.addEventListener("click", () => {
        window.AMEBA && window.AMEBA.openDeliverableFocus && window.AMEBA.openDeliverableFocus(d.deliverableId);
      });
      dlList.appendChild(li);
    });
    if (!deadlines.length) {
      dlList.innerHTML = `<li class="rail-deadline-row"><span class="rail-deadline-row__name rail-deadline-row__name--empty">No deadlines found</span></li>`;
    }
    dlMod.appendChild(dlList);
    middleZone.appendChild(dlMod);

    // 2d. Quick supply — real asset count
    const supplyMod = el("section", "rail-module");
    supplyMod.innerHTML = `<h2 class="rail-module__title">Quick Supply</h2>`;
    const supplyPlaceholder = el("div", "rail-supply-placeholder");
    const linkedCount = metrics ? metrics.linkedAssets : 0;
    const totalCount  = metrics ? metrics.totalAssets  : 0;
    supplyPlaceholder.innerHTML =
      `<p class="rail-supply-placeholder__text">${linkedCount} of ${totalCount} assets linked to campaign.</p>` +
      `<span class="rail-supply-placeholder__cta">\u2192 Go to Supply</span>`;
    supplyPlaceholder.querySelector(".rail-supply-placeholder__cta").addEventListener("click", () => {
      window.AMEBA && window.AMEBA.navigateToPage && window.AMEBA.navigateToPage("supply");
    });
    supplyMod.appendChild(supplyPlaceholder);
    middleZone.appendChild(supplyMod);

    rail.appendChild(middleZone);

    /* ── Zone 3: Bottom — comments + ambient signal ───────────────────────── */
    const bottomZone = el("div", "rail-bottom-zone");

    // Comments / interactions stack
    const commentsMod = el("section", "rail-module rail-module--bottom");
    commentsMod.innerHTML = `<h2 class="rail-module__title">Recent Activity</h2>`;
    const commentsList = el("ul", "rail-module__list");
    MOCK.interactions.slice(0, 3).forEach(i => {
      const li = el("li", "rail-message-row");
      li.innerHTML =
        `<span class="rail-message-row__who">${i.who} <span style="font-weight:400;color:#505080">\u00b7 ${i.type}</span></span>` +
        `<span class="rail-message-row__text">${i.text}</span>`;
      commentsList.appendChild(li);
    });
    commentsMod.appendChild(commentsList);
    bottomZone.appendChild(commentsMod);

    // Ambient signal
    const ambientEl = el("div", "rail-ambient");
    ambientEl.textContent = "\u2600\ufe0f  Lunch time!!!";
    bottomZone.appendChild(ambientEl);

    rail.appendChild(bottomZone);
  }

  /* ---------- Navigation -------------------------------------------------- */
  const pageRenderers = {
    workshop: renderWorkshop,
    campaign: renderCampaign,
    supply:   renderSupply
  };

  let currentPage = "workshop";

  function activatePage(pageId) {
    if (pageId === currentPage) return;
    currentPage = pageId;

    // Update nav items
    document.querySelectorAll(".ameba-nav__item").forEach(btn => {
      const active = btn.dataset.page === pageId;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-current", active ? "page" : "false");
    });

    // Update page views
    document.querySelectorAll(".page-view").forEach(view => {
      const active = view.dataset.view === pageId;
      view.hidden = !active;
      view.classList.toggle("is-active", active);
    });

    // Always re-render campaign and supply to reflect latest active campaign
    const container = document.querySelector(`.page-view[data-view="${pageId}"]`);
    if (container) {
      if (pageId === "campaign" || pageId === "supply" || !container.dataset.rendered) {
        if (pageRenderers[pageId]) {
          pageRenderers[pageId](container);
          container.dataset.rendered = "1";
        }
      }
    }
  }

  /* ---------- Cross-Module Navigation Helpers ----------------------------- */
  window.AMEBA = window.AMEBA || {};

  /**
   * Navigate to a top-level page (workshop | campaign | supply).
   */
  window.AMEBA.navigateToPage = function (pageId) {
    activatePage(pageId);
  };

  /**
   * Open the Campaign page and navigate directly to a section.
   * sectionId: overview | production | strategy | assets | delivery
   */
  window.AMEBA.openCampaignSection = function (sectionId) {
    activatePage("campaign");
    if (window.CampaignModule && window.CampaignModule.navigate) {
      window.CampaignModule.navigate(sectionId);
    }
  };

  /**
   * Open Campaign > Production and focus a specific deliverable.
   * deliverableId: e.g. "d1"
   */
  window.AMEBA.openDeliverableFocus = function (deliverableId) {
    activatePage("campaign");
    if (window.CampaignModule && window.CampaignModule.navigate) {
      window.CampaignModule.navigate("production", deliverableId);
    }
  };

  /**
   * Switch the active campaign and re-render affected pages.
   * campaignId: e.g. "c1", "c2", "c3"
   */
  window.AMEBA.setActiveCampaign = function (campaignId) {
    if (store()) store().setActiveCampaign(campaignId);
    // Re-render workshop if open
    const wsContainer = document.getElementById("pageWorkshop");
    if (wsContainer) {
      renderWorkshop(wsContainer);
      wsContainer.dataset.rendered = "1";
    }
    // Re-render campaign page if already rendered (force re-render on next open)
    const campContainer = document.querySelector('.page-view[data-view="campaign"]');
    if (campContainer) {
      delete campContainer.dataset.rendered;
      if (currentPage === "campaign") {
        renderCampaign(campContainer);
        campContainer.dataset.rendered = "1";
      }
    }
    // Re-render supply page if already rendered
    const supplyContainer = document.querySelector('.page-view[data-view="supply"]');
    if (supplyContainer) {
      delete supplyContainer.dataset.rendered;
      if (currentPage === "supply") {
        renderSupply(supplyContainer);
        supplyContainer.dataset.rendered = "1";
      }
    }
    // Re-render rail
    const rail = document.getElementById("amebaRail");
    if (rail) renderRail(rail);
  };

  /* ---------- Init -------------------------------------------------------- */
  function init() {
    const shell = document.getElementById("amebaShell");
    if (!shell) return;

    // Seed campaign storage from defaults if not yet initialised
    if (window.AMEBA && window.AMEBA.storage && window.AMEBA.storage.campaign) {
      window.AMEBA.storage.campaign.init();
    }

    // Wire nav buttons
    document.querySelectorAll(".ameba-nav__item").forEach(btn => {
      btn.addEventListener("click", () => activatePage(btn.dataset.page));
    });

    // Render Workshop (default)
    const workshopContainer = document.getElementById("pageWorkshop");
    if (workshopContainer) {
      renderWorkshop(workshopContainer);
      workshopContainer.dataset.rendered = "1";
    }

    // Render Ameba rail
    const rail = document.getElementById("amebaRail");
    if (rail) {
      renderRail(rail);
    }

    console.log("[ameba] Workshop shell initialized");
  }

  // Run on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

}());
