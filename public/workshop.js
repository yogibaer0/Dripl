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
  function getCampaignMetrics() {
    if (!store()) return null;
    const campaign = store().getCampaign();
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

  /* ---------- Workshop Page ----------------------------------------------- */
  function renderWorkshop(container) {
    container.innerHTML = "";

    const metrics = getCampaignMetrics();
    if (!metrics) {
      container.innerHTML = '<p style="color:#6060a0;padding:24px">No campaign data available.</p>';
      return;
    }

    const { campaign } = metrics;

    // Header
    const header = el("div", "ws-header");
    header.innerHTML = `
      <h1 class="ws-header__title">Workshop</h1>
      <p class="ws-header__subtitle">Campaign control room &mdash; ${campaign.name}</p>
    `;
    container.appendChild(header);

    // Grid
    const grid = el("div", "ws-grid");
    container.appendChild(grid);

    // 1 — Active Campaign Panel (full width)
    const campaignWrap = el("div", "ws-grid--full");
    campaignWrap.appendChild(renderActiveCampaignPanel(metrics));
    grid.appendChild(campaignWrap);

    // 2 — Production Status (col 1) + Deadlines (col 2)
    grid.appendChild(renderProductionStatusCard(metrics));
    grid.appendChild(renderDeadlinesCard(metrics));

    // 3 — Assets & Delivery (col 1) + Interactions (col 2)
    grid.appendChild(renderAssetsDeliveryCard(metrics));
    grid.appendChild(renderInteractionsCard());

    // 4 — Team (full width)
    const teamWrap = el("div", "ws-grid--full");
    teamWrap.appendChild(renderTeamCard());
    grid.appendChild(teamWrap);
  }

  /* ---------- Active Campaign Panel --------------------------------------- */
  function renderActiveCampaignPanel(metrics) {
    const { campaign, total, inReview, approved, inProd, draft, phase, exportReadiness } = metrics;

    const card = el("div", "ws-card ws-card--clickable ws-campaign-panel");
    card.setAttribute("title", "Open Campaign");

    // Left: identity
    const left = el("div", "ws-campaign-panel__left");

    const topRow = el("div", "ws-campaign-panel__top");
    const dot    = el("span", "ws-campaign-panel__dot");
    const badge  = el("span", "ws-campaign-panel__phase", phase);
    topRow.appendChild(dot);
    topRow.appendChild(badge);
    left.appendChild(topRow);

    const nameEl = el("h2", "ws-campaign-panel__name", campaign.name);
    left.appendChild(nameEl);

    const meta = el("div", "ws-campaign-panel__meta");
    meta.innerHTML =
      `<span>${campaign.client}</span>` +
      `<span class="ws-meta-sep">\u00b7</span>` +
      `<span>${campaign.type}</span>` +
      `<span class="ws-meta-sep">\u00b7</span>` +
      `<span>${campaign.duration}</span>`;
    left.appendChild(meta);
    card.appendChild(left);

    // Right: key stats
    const stats = el("div", "ws-campaign-panel__stats");
    [
      { label: "Deliverables", value: total,                color: "#a78bfa" },
      { label: "In Review",    value: inReview,              color: "#f59e0b" },
      { label: "Approved",     value: approved,              color: "#4ade80" },
      { label: "In Prod",      value: inProd,                color: "#60a5fa" },
      { label: "Readiness",    value: exportReadiness + "%", color: "#34d399" }
    ].forEach(stat => {
      const s = el("div", "ws-campaign-panel__stat");
      s.innerHTML =
        `<span class="ws-campaign-panel__stat-val" style="color:${stat.color}">${stat.value}</span>` +
        `<span class="ws-campaign-panel__stat-lbl">${stat.label}</span>`;
      stats.appendChild(s);
    });
    card.appendChild(stats);

    card.addEventListener("click", () => {
      window.AMEBA && window.AMEBA.navigateToPage && window.AMEBA.navigateToPage("campaign");
    });

    return card;
  }

  /* ---------- Production Status Card -------------------------------------- */
  function _statusSlug(status) {
    return { "Draft": "draft", "In Production": "inprod", "In Review": "review", "Approved": "approved" }[status] || "draft";
  }

  function renderProductionStatusCard(metrics) {
    const { campaign, total, inReview, approved, inProd, draft } = metrics;
    const deliverables = campaign.production.deliverables || [];

    const card = el("div", "ws-card ws-card--clickable");
    card.setAttribute("title", "Open Production");

    const titleRow = el("h2", "ws-card__title");
    titleRow.innerHTML = `Production <span class="ws-card__count">${total}</span>`;
    card.appendChild(titleRow);

    // Status pills
    const pills = el("div", "ws-status-pills");
    [
      { label: "In Review",    count: inReview, cls: "ws-status-pill--review"   },
      { label: "Approved",     count: approved, cls: "ws-status-pill--approved" },
      { label: "In Prod",      count: inProd,   cls: "ws-status-pill--inprod"   },
      { label: "Draft",        count: draft,    cls: "ws-status-pill--draft"    }
    ].forEach(p => {
      if (!p.count) return;
      const pill = el("span", `ws-status-pill ${p.cls}`);
      pill.innerHTML = `${p.label} <b>${p.count}</b>`;
      pills.appendChild(pill);
    });
    card.appendChild(pills);

    // Mini deliverable list (up to 4)
    const list = el("ul", "ws-prod-list");
    deliverables.slice(0, 4).forEach(d => {
      const item = el("li", "ws-prod-item");
      item.innerHTML =
        `<span class="ws-prod-item__status ws-prod-item__status--${_statusSlug(d.status)}"></span>` +
        `<span class="ws-prod-item__name">${d.title}</span>` +
        `<span class="ws-prod-item__platform">${d.platform}</span>`;
      item.addEventListener("click", e => {
        e.stopPropagation();
        window.AMEBA && window.AMEBA.openDeliverableFocus && window.AMEBA.openDeliverableFocus(d.id);
      });
      list.appendChild(item);
    });
    card.appendChild(list);

    card.addEventListener("click", () => {
      window.AMEBA && window.AMEBA.openCampaignSection && window.AMEBA.openCampaignSection("production");
    });

    return card;
  }

  /* ---------- Deadlines Card ---------------------------------------------- */
  function renderDeadlinesCard(metrics) {
    const { deadlines } = metrics;

    const card = el("div", "ws-card");

    const titleRow = el("h2", "ws-card__title");
    titleRow.innerHTML = `Deadlines <span class="ws-card__count">${deadlines.length}</span>`;
    card.appendChild(titleRow);

    const list = el("ul", "ws-deadline-list");
    deadlines.slice(0, 5).forEach(d => {
      const urgency = _urgencyClass(d.date);
      const item    = el("li", `ws-deadline-item ws-deadline-item--${urgency} ws-deadline-item--clickable`);
      item.innerHTML =
        `<div class="ws-deadline-item__main">` +
          `<div class="ws-deadline-item__name">${d.name}</div>` +
          `<div class="ws-deadline-item__event">${d.event}</div>` +
        `</div>` +
        `<div class="ws-deadline-item__date">${d.date}</div>`;
      item.addEventListener("click", () => {
        window.AMEBA && window.AMEBA.openDeliverableFocus && window.AMEBA.openDeliverableFocus(d.deliverableId);
      });
      list.appendChild(item);
    });
    card.appendChild(list);

    return card;
  }

  /* ---------- Assets & Delivery Card -------------------------------------- */
  function renderAssetsDeliveryCard(metrics) {
    const { linkedAssets, totalAssets, exportReadiness, readyCount } = metrics;

    const card = el("div", "ws-card ws-card--assets-delivery");

    // Assets panel
    const assetsPanel = el("div", "ws-ad-panel ws-card--clickable");
    assetsPanel.setAttribute("title", "Open Assets");
    const assetsTitle = el("h2", "ws-card__title", "Assets");
    assetsPanel.appendChild(assetsTitle);

    const assetStat = el("div", "ws-supply-stat");
    assetStat.innerHTML =
      `<span class="ws-supply-stat__val">${linkedAssets}</span>` +
      `<span class="ws-supply-stat__lbl">linked</span>`;
    assetsPanel.appendChild(assetStat);

    const assetSub = el("div", "ws-supply-substat",
      `${totalAssets} total \u00b7 ${totalAssets - linkedAssets} unlinked`);
    assetsPanel.appendChild(assetSub);

    assetsPanel.addEventListener("click", () => {
      window.AMEBA && window.AMEBA.openCampaignSection && window.AMEBA.openCampaignSection("assets");
    });

    // Delivery panel
    const deliveryPanel = el("div", "ws-ad-panel ws-card--clickable");
    deliveryPanel.setAttribute("title", "Open Delivery");
    const deliveryTitle = el("h2", "ws-card__title", "Delivery");
    deliveryPanel.appendChild(deliveryTitle);

    const deliveryStat = el("div", "ws-supply-stat");
    deliveryStat.innerHTML =
      `<span class="ws-supply-stat__val">${exportReadiness}%</span>` +
      `<span class="ws-supply-stat__lbl">readiness</span>`;
    deliveryPanel.appendChild(deliveryStat);

    const bar = el("div", "ws-readiness-bar");
    const fill = el("div", "ws-readiness-bar__fill");
    fill.style.width = exportReadiness + "%";
    bar.appendChild(fill);
    deliveryPanel.appendChild(bar);

    const deliverySub = el("div", "ws-supply-substat", `${readyCount} ready for export`);
    deliveryPanel.appendChild(deliverySub);

    deliveryPanel.addEventListener("click", () => {
      window.AMEBA && window.AMEBA.openCampaignSection && window.AMEBA.openCampaignSection("delivery");
    });

    card.appendChild(assetsPanel);
    card.appendChild(deliveryPanel);

    return card;
  }

  /* ---------- Interactions Card ------------------------------------------- */
  function renderInteractionsCard() {
    const card = el("div", "ws-card");

    const titleRow = el("h2", "ws-card__title");
    titleRow.innerHTML = `New Interactions <span class="ws-card__count">${MOCK.interactions.length}</span>`;
    card.appendChild(titleRow);

    const list = el("ul", "ws-interaction-list");
    MOCK.interactions.forEach(i => {
      const item = el("li", "ws-interaction-item");
      item.appendChild(avatar(i.initials, i.color, 30));

      const body = el("div", "ws-interaction-item__body");
      body.innerHTML =
        `<div class="ws-interaction-item__who">` +
          `${i.who}` +
          `<span class="ws-interaction-item__type">${i.type}</span>` +
        `</div>` +
        `<div class="ws-interaction-item__text">${i.text}</div>`;
      item.appendChild(body);
      list.appendChild(item);
    });
    card.appendChild(list);
    return card;
  }

  /* ---------- Team Card --------------------------------------------------- */
  function renderTeamCard() {
    const card = el("div", "ws-card");

    const titleRow = el("h2", "ws-card__title");
    titleRow.innerHTML = `Team <span class="ws-card__count">${MOCK.team.filter(t => t.online === "active").length} online</span>`;
    card.appendChild(titleRow);

    const list = el("ul", "ws-team-list");
    MOCK.team.forEach(t => {
      const item = el("li", "ws-team-item");
      item.appendChild(avatar(t.initials, t.color, 32));

      const info = el("div", "ws-team-item__info");
      info.innerHTML =
        `<div class="ws-team-item__name">${t.name}</div>` +
        `<div class="ws-team-item__status">${t.status}</div>`;

      const dot = el("span", `ws-team-item__online ws-team-item__online--${t.online}`);

      item.appendChild(info);
      item.appendChild(dot);
      list.appendChild(item);
    });
    card.appendChild(list);
    return card;
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

    // Render the page if not yet rendered
    const container = document.querySelector(`.page-view[data-view="${pageId}"]`);
    if (container && !container.dataset.rendered) {
      if (pageRenderers[pageId]) {
        pageRenderers[pageId](container);
        container.dataset.rendered = "1";
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
