/* ==========================================================================
   AMEBA Workshop Shell — Navigation, Pages & Rail
   ========================================================================== */

(function WorkshopShell() {
  "use strict";

  /* ---------- Mock Data --------------------------------------------------- */
  const MOCK = {
    campaigns: [
      { id: "c1", name: "Summer Drop 2025",     client: "Natura Vitae",    phase: "Production",  status: "active", color: "#a78bfa" },
      { id: "c2", name: "Brand Reset Q3",       client: "Elevate Co.",     phase: "Strategy",    status: "review", color: "#f59e0b" },
      { id: "c3", name: "Influencer Collab #4", client: "ZenWear Studio",  phase: "Assets",      status: "active", color: "#34d399" }
    ],
    deadlines: [
      { id: "d1", name: "Final cut delivery",    campaign: "Summer Drop 2025",  date: "Mar 20", urgency: "urgent" },
      { id: "d2", name: "Strategy deck review",  campaign: "Brand Reset Q3",    date: "Mar 22", urgency: "soon"   },
      { id: "d3", name: "Influencer brief",      campaign: "Influencer Collab #4", date: "Mar 25", urgency: "normal" },
      { id: "d4", name: "Client feedback call",  campaign: "Natura Vitae",      date: "Mar 28", urgency: "normal" },
      { id: "d5", name: "Assets upload",         campaign: "ZenWear Studio",    date: "Apr 2",  urgency: "normal" }
    ],
    interactions: [
      { id: "i1", who: "Sophie M.", initials: "SM", color: "#a78bfa", type: "comment",  text: "Love the new color direction on slide 4, but can we try a warmer tone?" },
      { id: "i2", who: "Carlos L.", initials: "CL", color: "#34d399", type: "approval", text: "Strategy deck approved. Ready to move to production phase." },
      { id: "i3", who: "Yuki T.",   initials: "YT", color: "#f59e0b", type: "feedback", text: "The intro hook feels a bit too slow. Consider trimming first 3 seconds." },
      { id: "i4", who: "Amara K.",  initials: "AK", color: "#f87171", type: "comment",  text: "Can we get higher-res versions of the hero images?" }
    ],
    team: [
      { id: "t1", name: "Sophie M.",  initials: "SM", color: "#a78bfa", status: "Working on Brand Reset deck", online: "active" },
      { id: "t2", name: "Carlos L.",  initials: "CL", color: "#34d399", status: "Away — back at 3pm",          online: "away"   },
      { id: "t3", name: "Yuki T.",    initials: "YT", color: "#f59e0b", status: "Reviewing Influencer brief",  online: "active" }
    ],
    messages: [
      { id: "m1", who: "Sophie M.", initials: "SM", color: "#a78bfa", text: "Can someone check the brand kit folder?" },
      { id: "m2", who: "Yuki T.",   initials: "YT", color: "#f59e0b", text: "New assets uploaded for ZenWear." }
    ],
    blobs: [
      { id: "b1", label: "Try a square crop",      desc: "Summer Drop hero could work as 1:1 for Instagram" },
      { id: "b2", label: "Add a deadline reminder", desc: "Final cut delivery is in 2 days" }
    ]
  };

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

  /* ---------- Workshop Page ----------------------------------------------- */
  function renderWorkshop(container) {
    container.innerHTML = "";

    // Header
    const header = el("div", "ws-header");
    header.innerHTML = `
      <h1 class="ws-header__title">Workshop</h1>
      <p class="ws-header__subtitle">Your active work, deadlines, and team pulse — all in one place.</p>
    `;
    container.appendChild(header);

    // Grid
    const grid = el("div", "ws-grid");
    container.appendChild(grid);

    // Active Campaigns card (full width)
    grid.appendChild(renderCampaignsCard());

    // Deadlines card
    grid.appendChild(renderDeadlinesCard());

    // Highlights / Interactions card
    grid.appendChild(renderInteractionsCard());

    // Team quick updates (full row)
    const teamWrap = el("div", "ws-grid--full");
    teamWrap.appendChild(renderTeamCard());
    grid.appendChild(teamWrap);
  }

  function renderCampaignsCard() {
    const card = el("div", "ws-card ws-grid--full");

    const titleRow = el("h2", "ws-card__title");
    titleRow.innerHTML = `Active Campaigns <span class="ws-card__count">${MOCK.campaigns.length}</span>`;
    card.appendChild(titleRow);

    const list = el("ul", "ws-campaign-list");
    MOCK.campaigns.forEach(c => {
      const item = el("li", "ws-campaign-item");
      const dot = el("span", "ws-campaign-item__dot");
      dot.style.background = c.color;

      const info = el("div", "ws-campaign-item__info");
      info.innerHTML = `
        <div class="ws-campaign-item__name">${c.name}</div>
        <div class="ws-campaign-item__meta">${c.client} · ${c.phase}</div>
      `;

      const statusCls = c.status === "active" ? "ws-campaign-item__status--active" : "ws-campaign-item__status--review";
      const statusLabel = c.status === "active" ? "Active" : "In Review";
      const statusBadge = el("span", `ws-campaign-item__status ${statusCls}`, statusLabel);

      item.appendChild(dot);
      item.appendChild(info);
      item.appendChild(statusBadge);
      list.appendChild(item);
    });
    card.appendChild(list);
    return card;
  }

  function renderDeadlinesCard() {
    const card = el("div", "ws-card");

    const titleRow = el("h2", "ws-card__title");
    titleRow.innerHTML = `Upcoming Deadlines <span class="ws-card__count">${MOCK.deadlines.length}</span>`;
    card.appendChild(titleRow);

    const list = el("ul", "ws-deadline-list");
    MOCK.deadlines.forEach(d => {
      const item = el("li", `ws-deadline-item ws-deadline-item--${d.urgency}`);
      item.innerHTML = `
        <div class="ws-deadline-item__name">${d.name}</div>
        <div class="ws-deadline-item__campaign">${d.campaign}</div>
        <div class="ws-deadline-item__date">${d.date}</div>
      `;
      list.appendChild(item);
    });
    card.appendChild(list);
    return card;
  }

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
      body.innerHTML = `
        <div class="ws-interaction-item__who">
          ${i.who}
          <span class="ws-interaction-item__type">${i.type}</span>
        </div>
        <div class="ws-interaction-item__text">${i.text}</div>
      `;
      item.appendChild(body);
      list.appendChild(item);
    });
    card.appendChild(list);
    return card;
  }

  function renderTeamCard() {
    const card = el("div", "ws-card");

    const titleRow = el("h2", "ws-card__title");
    titleRow.innerHTML = `Team <span class="ws-card__count">${MOCK.team.filter(t=>t.online==="active").length} online</span>`;
    card.appendChild(titleRow);

    const list = el("ul", "ws-team-list");
    MOCK.team.forEach(t => {
      const item = el("li", "ws-team-item");
      item.appendChild(avatar(t.initials, t.color, 32));

      const info = el("div", "ws-team-item__info");
      info.innerHTML = `
        <div class="ws-team-item__name">${t.name}</div>
        <div class="ws-team-item__status">${t.status}</div>
      `;

      const dot = el("span", `ws-team-item__online ws-team-item__online--${t.online}`);

      item.appendChild(info);
      item.appendChild(dot);
      list.appendChild(item);
    });
    card.appendChild(list);
    return card;
  }

  /* ---------- Campaign Placeholder --------------------------------------- */
  function renderCampaign(container) {
    container.innerHTML = `
      <div class="placeholder-view">
        <div class="placeholder-view__icon">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">
            <path d="M3 10 L10 3 L17 10 L17 18 H3 Z"/>
            <rect x="7" y="13" width="6" height="5" rx="1" fill="currentColor" opacity="0.5" stroke="none"/>
          </svg>
        </div>
        <span class="placeholder-view__badge">Coming in Pass 2</span>
        <h1 class="placeholder-view__title">Campaign Workspace</h1>
        <p class="placeholder-view__subtitle">Full campaign management — strategy, production, assets, delivery, and deliverable views — are coming in the next pass.</p>
      </div>
    `;
  }

  /* ---------- Supply Placeholder ----------------------------------------- */
  function renderSupply(container) {
    container.innerHTML = `
      <div class="placeholder-view">
        <div class="placeholder-view__icon">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2" y="5" width="16" height="12" rx="2"/>
            <path d="M6 5 V3 a4 4 0 0 1 8 0 V5" stroke-linecap="round"/>
            <circle cx="10" cy="11" r="2" fill="currentColor" opacity="0.6" stroke="none"/>
          </svg>
        </div>
        <span class="placeholder-view__badge">Coming in Pass 2</span>
        <h1 class="placeholder-view__title">Supply</h1>
        <p class="placeholder-view__subtitle">Campaign-aware assets, uploads, recent files, and linked supply — arriving in the next pass with full campaign context.</p>
      </div>
    `;
  }

  /* ---------- Ameba Rail -------------------------------------------------- */
  function renderRail(rail) {
    rail.innerHTML = "";

    // 1. Team online
    const teamMod = el("section", "rail-module");
    teamMod.innerHTML = `<h2 class="rail-module__title">Team Online</h2>`;
    const teamList = el("ul", "rail-module__list");
    MOCK.team.forEach(t => {
      const li = el("li", "rail-team-member");
      li.appendChild(avatar(t.initials, t.color, 28));
      const name = el("span", "rail-team-member__name", t.name);
      const dot = el("span", "rail-team-member__status");
      dot.style.background = t.online === "active" ? "#4ade80" : (t.online === "away" ? "#f59e0b" : "#f87171");
      li.appendChild(name);
      li.appendChild(dot);
      teamList.appendChild(li);
    });
    teamMod.appendChild(teamList);
    rail.appendChild(teamMod);

    // 2. Active campaigns
    const campMod = el("section", "rail-module");
    campMod.innerHTML = `<h2 class="rail-module__title">Active Campaigns</h2>`;
    const campList = el("ul", "rail-module__list");
    MOCK.campaigns.forEach(c => {
      const li = el("li", "rail-campaign-row");
      li.innerHTML = `
        <span class="rail-campaign-row__name">${c.name}</span>
        <span class="rail-campaign-row__meta">${c.phase}</span>
      `;
      campList.appendChild(li);
    });
    campMod.appendChild(campList);
    rail.appendChild(campMod);

    // 3. Upcoming deadlines
    const dlMod = el("section", "rail-module");
    dlMod.innerHTML = `<h2 class="rail-module__title">Upcoming Deadlines</h2>`;
    const dlList = el("ul", "rail-module__list");
    MOCK.deadlines.slice(0, 4).forEach(d => {
      const li = el("li", "rail-deadline-row");
      li.innerHTML = `
        <span class="rail-deadline-row__name">${d.name}</span>
        <span class="rail-deadline-row__date ${d.urgency !== 'normal' ? 'is-soon' : ''}">${d.date}</span>
      `;
      dlList.appendChild(li);
    });
    dlMod.appendChild(dlList);
    rail.appendChild(dlMod);

    // 4. Client feedback
    const fbMod = el("section", "rail-module");
    fbMod.innerHTML = `<h2 class="rail-module__title">Client Feedback</h2>`;
    const fbList = el("ul", "rail-module__list");
    MOCK.interactions.filter(i => i.type !== "approval").slice(0, 2).forEach(i => {
      const li = el("li", "rail-message-row");
      li.innerHTML = `
        <span class="rail-message-row__who">${i.who}</span>
        <span class="rail-message-row__text">${i.text}</span>
      `;
      fbList.appendChild(li);
    });
    fbMod.appendChild(fbList);
    rail.appendChild(fbMod);

    // 5. New comments / interactions
    const intMod = el("section", "rail-module");
    intMod.innerHTML = `<h2 class="rail-module__title">New Comments</h2>`;
    const intList = el("ul", "rail-module__list");
    MOCK.interactions.slice(0, 3).forEach(i => {
      const li = el("li", "rail-message-row");
      li.innerHTML = `
        <span class="rail-message-row__who">${i.who} <span style="font-weight:400;color:#505080">· ${i.type}</span></span>
        <span class="rail-message-row__text">${i.text}</span>
      `;
      intList.appendChild(li);
    });
    intMod.appendChild(intList);
    rail.appendChild(intMod);

    // 6. Inter-team messages
    const msgMod = el("section", "rail-module");
    msgMod.innerHTML = `<h2 class="rail-module__title">Team Messages</h2>`;
    const msgList = el("ul", "rail-module__list");
    MOCK.messages.forEach(m => {
      const li = el("li", "rail-message-row");
      li.innerHTML = `
        <span class="rail-message-row__who">${m.who}</span>
        <span class="rail-message-row__text">${m.text}</span>
      `;
      msgList.appendChild(li);
    });
    msgMod.appendChild(msgList);
    rail.appendChild(msgMod);

    // 7. Blob suggestions
    const blobMod = el("section", "rail-module");
    blobMod.innerHTML = `<h2 class="rail-module__title">Blob Suggestions</h2>`;
    const blobList = el("ul", "rail-module__list");
    MOCK.blobs.forEach(b => {
      const li = el("li", "rail-blob-row");
      li.innerHTML = `
        <span class="rail-blob-row__label">💡 ${b.label}</span>
        <span class="rail-blob-row__desc">${b.desc}</span>
      `;
      blobList.appendChild(li);
    });
    blobMod.appendChild(blobList);
    rail.appendChild(blobMod);

    // 8. Quick supply placeholder
    const supplyMod = el("section", "rail-module");
    supplyMod.innerHTML = `<h2 class="rail-module__title">Quick Supply</h2>`;
    const supplyPlaceholder = el("div", "rail-supply-placeholder");
    supplyPlaceholder.innerHTML = `
      <p class="rail-supply-placeholder__text">Campaign assets and uploads will appear here.</p>
      <span class="rail-supply-placeholder__cta">→ Go to Supply</span>
    `;
    supplyPlaceholder.querySelector(".rail-supply-placeholder__cta").addEventListener("click", () => {
      activatePage("supply");
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

  /* ---------- Init -------------------------------------------------------- */
  function init() {
    const shell = document.getElementById("amebaShell");
    if (!shell) return;

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
