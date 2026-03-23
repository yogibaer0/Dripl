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

  /* ---------- Derived Header (context-aware) -------------------------------- */
  function renderDerivedHeader(metrics) {
    const campaign = metrics.campaign;
    const phase    = metrics.phase;

    const PHASE_ACCENT = {
      "Production":        "#60a5fa",
      "In Review":         "#f59e0b",
      "Review / Delivery": "#a78bfa",
      "Complete":          "#4ade80"
    };
    const PHASE_CONTEXT = {
      "Production":        "Active production in progress",
      "In Review":         "Content entering final approval stage",
      "Review / Delivery": "Review and delivery pipeline active",
      "Complete":          "All deliverables approved and ready"
    };

    const accent  = PHASE_ACCENT[phase]  || "#a78bfa";
    const context = PHASE_CONTEXT[phase] || "Active";

    const header = el("div", "ws-derived-header");

    const top = el("div", "ws-derived-header__top");
    top.appendChild(el("h1", "ws-derived-header__name", campaign.name));

    const phaseBadge = el("span", "ws-derived-header__phase");
    phaseBadge.textContent = phase.toUpperCase();
    phaseBadge.style.color       = accent;
    phaseBadge.style.borderColor = accent + "44";
    phaseBadge.style.background  = accent + "18";
    top.appendChild(phaseBadge);
    header.appendChild(top);

    const ctxLine = el("p", "ws-derived-header__context",
      context +
      (campaign.client ? " \u00b7 " + campaign.client : "") +
      " \u00b7 " + metrics.approved + " of " + metrics.total + " approved"
    );
    header.appendChild(ctxLine);

    return header;
  }

  /* ---------- Production Mini-List (Workshop center) ----------------------- */
  function renderProductionMiniList(metrics) {
    if (!metrics) return null;
    const deliverables = metrics.campaign.production.deliverables || [];
    if (!deliverables.length) return null;

    const STATUS_SORT = { "In Review": 0, "In Production": 1, "Draft": 2, "Approved": 3 };
    const sorted = deliverables.slice().sort(function(a, b) {
      return (STATUS_SORT[a.status] || 99) - (STATUS_SORT[b.status] || 99);
    });

    const wrap = el("div", "ws-section-block");

    const labelRow = el("div", "ws-section-block__header");
    labelRow.appendChild(el("span", "ws-section-block__label", "Production"));
    labelRow.appendChild(el("span", "ws-section-block__count",
      metrics.inReview + " in review \u00b7 " + metrics.approved + " approved"));
    wrap.appendChild(labelRow);

    const STATUS_DOT = { "Draft": "draft", "In Production": "inprod", "In Review": "review", "Approved": "approved" };
    const STATUS_COLOR = {
      "Draft":         "#5a5a9a",
      "In Production": "#60a5fa",
      "In Review":     "#f59e0b",
      "Approved":      "#4ade80"
    };

    const list = el("ul", "ws-prod-list");
    sorted.forEach(function(d) {
      const statusKey = STATUS_DOT[d.status] || "draft";
      const isPending = d.status !== "Approved";
      const doneTasks = (d.tasks || []).filter(function(t) { return t.done; }).length;
      const totalTasks = (d.tasks || []).length;

      const item = el("li", "ws-prod-item" + (isPending ? " ws-prod-item--pending" : ""));

      const dot = el("span", "ws-prod-item__status ws-prod-item__status--" + statusKey);
      const name = el("span", "ws-prod-item__name", d.title);
      const platform = el("span", "ws-prod-item__platform", d.platform);

      const statusLbl = el("span", "ws-prod-item__status-label", d.status);
      statusLbl.style.color = STATUS_COLOR[d.status] || "#8888aa";

      item.appendChild(dot);
      item.appendChild(name);
      item.appendChild(platform);

      if (totalTasks > 0) {
        const taskProg = el("span", "ws-prod-item__tasks", doneTasks + "/" + totalTasks);
        item.appendChild(taskProg);
      }
      item.appendChild(statusLbl);

      item.addEventListener("click", function() {
        window.AMEBA && window.AMEBA.openDeliverableFocus &&
          window.AMEBA.openDeliverableFocus(d.id);
      });

      list.appendChild(item);
    });

    wrap.appendChild(list);
    return wrap;
  }

  /* ---------- Assets + Delivery Panel -------------------------------------- */
  function renderAssetsDelivery(metrics) {
    if (!metrics) return null;
    const campaign     = metrics.campaign;
    const deliverables = campaign.production.deliverables || [];

    const totalAssets   = metrics.totalAssets;
    const linkedAssets  = metrics.linkedAssets;
    const noAssetsDels  = deliverables.filter(function(d) {
      return !d.assetIds || d.assetIds.length === 0;
    }).length;
    const assetReadiness = totalAssets
      ? Math.min(100, Math.round((linkedAssets / totalAssets) * 100)) : 0;

    const wrap = el("div", "ws-ad-wrap");

    /* ---- Assets half ---- */
    const assetsPanel = el("div", "ws-ad-assets");

    const assetsHdr = el("div", "ws-ad-panel-header");
    assetsHdr.appendChild(el("span", "ws-ad-panel-label", "Assets"));
    assetsHdr.appendChild(el("span", "ws-ad-panel-question", "Are we ready to produce?"));
    assetsPanel.appendChild(assetsHdr);

    const statRow = el("div", "ws-ad-stat-row");

    const totalStat = el("div", "ws-ad-stat");
    totalStat.innerHTML =
      '<span class="ws-ad-stat__val">'      + totalAssets  + '</span>' +
      '<span class="ws-ad-stat__lbl">files</span>';

    const linkedStat = el("div", "ws-ad-stat");
    linkedStat.innerHTML =
      '<span class="ws-ad-stat__val ws-ad-stat__val--ok">' + linkedAssets + '</span>' +
      '<span class="ws-ad-stat__lbl">linked</span>';

    statRow.appendChild(totalStat);
    statRow.appendChild(el("span", "ws-ad-stat-sep", "\u00b7"));
    statRow.appendChild(linkedStat);

    if (noAssetsDels > 0) {
      statRow.appendChild(el("span", "ws-ad-missing-note",
        noAssetsDels + " deliverable" + (noAssetsDels > 1 ? "s" : "") + " missing assets"));
    }

    assetsPanel.appendChild(statRow);

    const barWrap = el("div", "ws-readiness-bar");
    const barFill = el("div", "ws-readiness-bar__fill");
    barFill.style.width = assetReadiness + "%";
    barWrap.appendChild(barFill);
    assetsPanel.appendChild(barWrap);
    assetsPanel.appendChild(el("div", "ws-ad-readiness-label",
      assetReadiness + "% of assets linked to deliverables"));

    assetsPanel.addEventListener("click", function() {
      window.AMEBA && window.AMEBA.openCampaignSection &&
        window.AMEBA.openCampaignSection("assets");
    });
    wrap.appendChild(assetsPanel);

    /* ---- Divider ---- */
    wrap.appendChild(el("div", "ws-ad-divider"));

    /* ---- Delivery half ---- */
    const deliveryPanel = el("div", "ws-ad-delivery");

    const deliveryHdr = el("div", "ws-ad-panel-header");
    deliveryHdr.appendChild(el("span", "ws-ad-panel-label", "Delivery"));
    deliveryHdr.appendChild(el("span", "ws-ad-panel-question", "Where are we in shipping?"));
    deliveryPanel.appendChild(deliveryHdr);

    const STATUSES = ["Draft", "In Production", "In Review", "Approved"];
    const STATUS_MAP = { "Draft": "draft", "In Production": "inprod", "In Review": "review", "Approved": "approved" };

    // Group deliverables by platform
    const byPlatform = {};
    deliverables.forEach(function(d) {
      if (!byPlatform[d.platform]) {
        byPlatform[d.platform] = { Draft: 0, "In Production": 0, "In Review": 0, "Approved": 0 };
      }
      byPlatform[d.platform][d.status] = (byPlatform[d.platform][d.status] || 0) + 1;
    });

    const platformRows = el("div", "ws-ad-platforms");
    Object.keys(byPlatform).forEach(function(platform) {
      const counts = byPlatform[platform];
      const total  = STATUSES.reduce(function(s, k) { return s + counts[k]; }, 0);

      const row = el("div", "ws-ad-platform-row");
      row.appendChild(el("span", "ws-ad-platform-name", platform));
      row.appendChild(el("span", "ws-ad-platform-total", total + " total"));

      const pills = el("div", "ws-ad-platform-pills");
      STATUSES.forEach(function(s) {
        if (!counts[s]) return;
        pills.appendChild(el("span", "ws-ad-pill ws-ad-pill--" + STATUS_MAP[s],
          counts[s] + " " + s));
      });
      row.appendChild(pills);

      platformRows.appendChild(row);
    });
    deliveryPanel.appendChild(platformRows);

    deliveryPanel.addEventListener("click", function() {
      window.AMEBA && window.AMEBA.openCampaignSection &&
        window.AMEBA.openCampaignSection("delivery");
    });
    wrap.appendChild(deliveryPanel);

    return wrap;
  }

  /* ---------- Workshop Page ----------------------------------------------- */
  function renderWorkshop(container) {
    container.innerHTML = "";

    const metrics = getCampaignMetrics();
    if (!metrics) {
      container.innerHTML = '<p style="color:#6060a0;padding:24px">No campaign data available.</p>';
      return;
    }

    // Derived header — above the layout grid
    container.appendChild(renderDerivedHeader(metrics));

    const layout = el("div", "ws-layout");
    container.appendChild(layout);

    // 1 — Team circles (top-right of main content area)
    const teamAnchor = el("div", "ws-team-anchor");
    teamAnchor.appendChild(renderTeamCircles());
    layout.appendChild(teamAnchor);

    // 2 — Campaigns anchor card (right column, full height)
    const campaignsAnchor = el("div", "ws-campaigns-anchor");
    campaignsAnchor.appendChild(renderCampaignsAnchorCard(container));
    layout.appendChild(campaignsAnchor);

    // 3 — Center content area: production list + assets/delivery
    const centerArea = el("div", "ws-center-area");
    const prodList = renderProductionMiniList(metrics);
    if (prodList) centerArea.appendChild(prodList);
    const adPanel = renderAssetsDelivery(metrics);
    if (adPanel) centerArea.appendChild(adPanel);
    layout.appendChild(centerArea);

    // 4 — Bottom section: calendar, tasks, ephemeral
    const bottomSection = el("div", "ws-bottom-section");
    layout.appendChild(bottomSection);

    bottomSection.appendChild(renderCalendarAnchor(metrics));

    const tasksEl = renderTasksArea(metrics);
    if (tasksEl) bottomSection.appendChild(tasksEl);

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

    // 1. Team online
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
    rail.appendChild(teamMod);

    // 2. Active campaign (real data)
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
    rail.appendChild(campMod);

    // 3. Upcoming deadlines (real data)
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
    rail.appendChild(dlMod);

    // 4. Client feedback (mock placeholder)
    const fbMod = el("section", "rail-module");
    fbMod.innerHTML = `<h2 class="rail-module__title">Client Feedback</h2>`;
    const fbList = el("ul", "rail-module__list");
    MOCK.interactions.filter(i => i.type !== "approval").slice(0, 2).forEach(i => {
      const li = el("li", "rail-message-row");
      li.innerHTML =
        `<span class="rail-message-row__who">${i.who}</span>` +
        `<span class="rail-message-row__text">${i.text}</span>`;
      fbList.appendChild(li);
    });
    fbMod.appendChild(fbList);
    rail.appendChild(fbMod);

    // 5. New comments (mock placeholder)
    const intMod = el("section", "rail-module");
    intMod.innerHTML = `<h2 class="rail-module__title">New Comments</h2>`;
    const intList = el("ul", "rail-module__list");
    MOCK.interactions.slice(0, 3).forEach(i => {
      const li = el("li", "rail-message-row");
      li.innerHTML =
        `<span class="rail-message-row__who">${i.who} <span style="font-weight:400;color:#505080">\u00b7 ${i.type}</span></span>` +
        `<span class="rail-message-row__text">${i.text}</span>`;
      intList.appendChild(li);
    });
    intMod.appendChild(intList);
    rail.appendChild(intMod);

    // 6. Inter-team messages (mock)
    const msgMod = el("section", "rail-module");
    msgMod.innerHTML = `<h2 class="rail-module__title">Team Messages</h2>`;
    const msgList = el("ul", "rail-module__list");
    MOCK.messages.forEach(m => {
      const li = el("li", "rail-message-row");
      li.innerHTML =
        `<span class="rail-message-row__who">${m.who}</span>` +
        `<span class="rail-message-row__text">${m.text}</span>`;
      msgList.appendChild(li);
    });
    msgMod.appendChild(msgList);
    rail.appendChild(msgMod);

    // 7. Blob suggestions (mock)
    const blobMod = el("section", "rail-module");
    blobMod.innerHTML = `<h2 class="rail-module__title">Blob Suggestions</h2>`;
    const blobList = el("ul", "rail-module__list");
    MOCK.blobs.forEach(b => {
      const li = el("li", "rail-blob-row");
      li.innerHTML =
        `<span class="rail-blob-row__label">\u{1F4A1} ${b.label}</span>` +
        `<span class="rail-blob-row__desc">${b.desc}</span>`;
      blobList.appendChild(li);
    });
    blobMod.appendChild(blobList);
    rail.appendChild(blobMod);

    // 8. Quick supply — real asset count
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
    rail.appendChild(supplyMod);
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
