/* ==========================================================================
   AMEBA — patched: detach satellites to overlay + robust hub sizing
   - Moves .dest-sat-rail into an overlay layer (document.body) so it never
     participates in layout, and positions it absolutely relative to dest-panel.
   - Keeps orbital controller, import icons, preview hover, and Hub API intact.
   ========================================================================== */

(function Ameba() {
  "use strict";

  const $ = (sel, root = document) => (root || document).querySelector(sel);
  const $$ = (sel, root = document) => Array.from((root || document).querySelectorAll(sel));
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);
  const log = (...a) => console.log("[ameba]", ...a);
  const err = (...a) => console.error("[ameba]", ...a);

  /* ----------------------
     Basic refs & utils
     ---------------------- */
  const els = {
    panelRoot: document.querySelector('.panels'),
    destPanel:  document.querySelector('.dest-panel'),
    railEl:     document.querySelector('.dest-sat-rail'),
    dropZone:   document.getElementById('dropzone'),
    fileInput:  document.getElementById('fileInput'),
    impDevice:  document.getElementById('imp-device'),
    impDropbox: document.getElementById('imp-dropbox'),
    impDrive:   document.getElementById('imp-drive'),
    pasteLink:  document.getElementById('paste-input'),
    convertBtn: document.getElementById('convert-btn')
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = () => performance.now() / 1000;

  /* ----------------------
     Safe detach of rail -> overlay
     - Moves .dest-sat-rail into document.body so it never affects layout.
     - Positions it absolutely relative to dest-panel bounds.
     ---------------------- */
  function attachRailAsOverlay() {
    const rail = els.railEl;
    const dest = els.destPanel;
    if (!rail || !dest) return;

    // Avoid doing it repeatedly
    if (!rail.__movedToOverlay) {
      // Make rail overlay-friendly
      rail.style.position = 'absolute';
      rail.style.pointerEvents = 'none'; // default; children will enable pointer events
      rail.style.zIndex = '60';
      // move to body so it doesn't affect grid layout
      document.body.appendChild(rail);
      rail.__movedToOverlay = true;
    }
    positionRail();
  }

  function positionRail() {
    const rail = els.railEl;
    const dest = els.destPanel;
    if (!rail || !dest) return;
    const d = dest.getBoundingClientRect();

    // Compute a point just outside the dest-panel right edge (orbit gutter)
    const gutter = 28; // visual gutter between hub and rail
    const railWidth = rail.offsetWidth || parseFloat(getComputedStyle(rail).width) || 72;
    const top = Math.round(window.scrollY + d.top + (d.height / 2) - (rail.offsetHeight / 2));
    // Place rail to the right of the dest-panel, using page coordinates
    const left = Math.round(window.scrollX + d.right + gutter);

    rail.style.top = `${top}px`;
    rail.style.left = `${left}px`;
    // ensure children are interactive
    rail.querySelectorAll('.satellite').forEach(s => s.style.pointerEvents = 'auto');
  }

  /* ----------------------
     Helpers for resize / layout changes
     ---------------------- */
  let layoutRaf = 0;
  function schedulePositionRail() {
    if (layoutRaf) cancelAnimationFrame(layoutRaf);
    layoutRaf = requestAnimationFrame(() => {
      layoutRaf = 0;
      positionRail();
    });
  }
  window.addEventListener('resize', schedulePositionRail);
  window.addEventListener('scroll', schedulePositionRail);

  /* ----------------------
     Import icons + preview hover wiring (idempotent)
     ---------------------- */
  function wireImportIcons() {
    const { impDevice, impDropbox, impDrive, fileInput } = els;
    if (impDevice && fileInput) {
      impDevice.tabIndex = 0;
      impDevice.addEventListener('click', () => fileInput.click());
      impDevice.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });
    }
    if (impDropbox) {
      impDropbox.tabIndex = 0;
      impDropbox.addEventListener('click', () => {
        const proxy = document.querySelector('[data-action="dropbox"], #btn-dropbox');
        if (proxy) proxy.click(); else log("[ameba] Dropbox proxy missing");
      });
      impDropbox.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') impDropbox.click(); });
    }
    if (impDrive) {
      impDrive.tabIndex = 0;
      impDrive.addEventListener('click', () => {
        const proxy = document.querySelector('[data-action="gdrive"], [data-action="google-drive"], #btn-gdrive');
        if (proxy) proxy.click(); else log("[ameba] Drive proxy missing");
      });
      impDrive.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') impDrive.click(); });
    }
  }

  function wirePreviewHover() {
    const preview = document.querySelector('.dest-panel .preview-wrap');
    if (!preview || preview.__hoverBound__) return;
    preview.__hoverBound__ = true;
    preview.addEventListener('mouseenter', () => preview.classList.add('is-hovering'));
    preview.addEventListener('mouseleave', () => preview.classList.remove('is-hovering'));
    preview.addEventListener('focusin', () => preview.classList.add('is-hovering'));
    preview.addEventListener('focusout', () => preview.classList.remove('is-hovering'));
  }

  /* ----------------------
     Orbit controller (keeps previous behavior)
     - Minor change: uses the detached rail (overlay) and repositions it on hub changes
     ---------------------- */
  (function OrbitalSatelliteController() {
    // find rail after DOM ready
    const waitFor = () => document.querySelector('.dest-sat-rail') && document.querySelector('.dest-panel');
    function ready(cb) {
      if (waitFor()) return cb();
      const id = setInterval(() => { if (waitFor()) { clearInterval(id); cb(); }}, 80);
    }

    ready(() => {
      // detach to overlay and position
      attachRailAsOverlay();

      const rail = document.querySelector('.dest-sat-rail');
      const stack = rail.querySelector('.dest-sat-stack');
      let sats = Array.from(stack.querySelectorAll('.satellite'));

      const SAT_CFG = { baseGap: 26, radiusPadding: 40, wobbleAmp: 6, angularSpeedBase: 0.6, speedJitter: 0.18 };

      // build per-satellite state
      let satState = sats.map((el, i) => ({
        el,
        angle: (i / Math.max(1, sats.length)) * Math.PI * 2,
        speed: SAT_CFG.angularSpeedBase * (1 + (Math.random() - 0.5) * SAT_CFG.speedJitter),
        phase: Math.random() * Math.PI * 2,
        orbitRadius: 0,
        target: { x: 0, y: 0 }
      }));

      const computeOrbitGeometry = () => {
        const preview = document.querySelector('.dest-panel .preview-wrap');
        if (!preview) return null;
        const r = preview.getBoundingClientRect();
        const hubCenter = { x: r.left + r.width/2 + window.scrollX, y: r.top + r.height/2 + window.scrollY };
        const baseRadius = Math.max(r.width, r.height)/2 + SAT_CFG.radiusPadding;
        return { previewRect: r, hubCenter, baseRadius };
      };

      const pointOnOrbit = (center, radius, angle) => ({ x: center.x + Math.cos(angle)*radius, y: center.y + Math.sin(angle)*radius });

      const moveSatTo = (el, tx, ty) => {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width/2 + window.scrollX;
        const cy = rect.top + rect.height/2 + window.scrollY;
        const dx = tx - cx, dy = ty - cy;
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      };

      // initial resting positions (left-side arc)
      function placeInitialRestingPositions() {
        const geo = computeOrbitGeometry();
        if (!geo) {
          setTimeout(placeInitialRestingPositions, 120);
          return;
        }
        const ring = geo.baseRadius + SAT_CFG.baseGap;
        const start = (210 * Math.PI)/180;
        const end = (300 * Math.PI)/180;
        const count = Math.max(1, satState.length);
        for (let i=0;i<count;i++){
          const t = count===1?0.5:(i/(count-1 || 1));
          const angle = start + (end - start) * t;
          satState[i].angle = angle;
          const p = pointOnOrbit(geo.hubCenter, ring, angle);
          moveSatTo(satState[i].el, p.x, p.y);
          satState[i].el.style.transition = "transform .36s cubic-bezier(.2,.9,.25,1), opacity .28s ease";
        }
        // ensure rail positioned
        positionRail();
      }

      let lastT = now();
      let raf = 0;
      function animateLoop() {
        const t = now();
        const dt = Math.max(0, t - lastT);
        lastT = t;
        const geo = computeOrbitGeometry();
        if (!geo) { raf = requestAnimationFrame(animateLoop); return; }
        const ringRadius = geo.baseRadius + SAT_CFG.baseGap;
        for (let i=0;i<satState.length;i++){
          const s = satState[i];
          s.angle += s.speed * dt;
          const wobble = Math.sin(t * (0.8 + (i % 3) * 0.12) + s.phase) * (SAT_CFG.wobbleAmp * 0.45);
          const p = pointOnOrbit(geo.hubCenter, ringRadius + wobble, s.angle);
          s.target.x = p.x; s.target.y = p.y; s.orbitRadius = ringRadius;
          moveSatTo(s.el, p.x, p.y);
        }
        raf = requestAnimationFrame(animateLoop);
      }

      function dockSatellite(index) {
        const geo = computeOrbitGeometry();
        if (!geo || !satState[index]) return;
        const dockX = geo.previewRect.right + SAT_CFG.radiusPadding + SAT_CFG.baseGap;
        const dockY = geo.previewRect.top + geo.previewRect.height * 0.18;
        const angle = Math.atan2(dockY - geo.hubCenter.y, dockX - geo.hubCenter.x);
        satState[index].angle = angle; satState[index].speed = 0.02;
        const el = satState[index].el; el.style.transition = "transform .42s cubic-bezier(.2,.9,.25,1), box-shadow .28s ease";
        moveSatTo(el, dockX, dockY); el.classList.add("is-active");
        positionRail();
      }

      function undockAll() {
        satState.forEach(s => {
          s.speed = SAT_CFG.angularSpeedBase * (1 + (Math.random()-0.5) * SAT_CFG.speedJitter);
          s.el.style.transition = "transform .36s cubic-bezier(.2,.9,.3,1), opacity .28s ease";
          s.el.classList.remove("is-active"); s.el.classList.remove("is-parking");
        });
      }

      function parkOthers(activeIndex) {
        const geo = computeOrbitGeometry(); if (!geo) return;
        const biasRadius = geo.baseRadius + SAT_CFG.baseGap + 16;
        const activeAngle = satState[activeIndex]?.angle ?? 0;
        let offset = 0;
        for (let i=0;i<satState.length;i++){
          if (i===activeIndex) continue;
          offset++; const sign = (offset%2===0)?1:-1; const level = Math.ceil(offset/2);
          const angle = activeAngle + sign*(0.28*level);
          const target = pointOnOrbit(geo.hubCenter, biasRadius + level*8, angle);
          satState[i].angle = angle; satState[i].speed = 0.02 + (Math.random()*0.03);
          satState[i].el.classList.add("is-parking");
          satState[i].el.style.transition = "transform .38s cubic-bezier(.2,.9,.3,1), opacity .28s ease";
          moveSatTo(satState[i].el, target.x, target.y);
        }
      }

      function bindClicks() {
        sats = Array.from(stack.querySelectorAll('.satellite'));
        // rebuild satState mapping if length changed
        if (sats.length !== satState.length) {
          const newState = sats.map((el,i) => {
            const existing = satState[i];
            return existing ? Object.assign(existing, { el }) : {
              el, angle:(i / Math.max(1,sats.length))*Math.PI*2,
              speed: SAT_CFG.angularSpeedBase*(1+(Math.random()-0.5)*SAT_CFG.speedJitter),
              phase: Math.random()*Math.PI*2, orbitRadius:0, target:{x:0,y:0}
            };
          });
          satState.length = 0; satState.push(...newState);
        }
        sats.forEach((s,i) => {
          s.addEventListener('click', () => {
            try {
              const platform = s.dataset.platform || "";
              const currentActive = (window.Hub && window.Hub.state && window.Hub.state.activePlatform) || null;
              if (currentActive === platform) { if (window.Hub && typeof window.Hub.returnToHub === "function") window.Hub.returnToHub(); undockAll(); }
              else { if (window.Hub && typeof window.Hub.activatePlatform === "function") window.Hub.activatePlatform(platform); const idx = satState.findIndex(ss=>ss.el===s); dockSatellite(idx); parkOthers(idx); }
            } catch (e) { console.error("[sat-click] error", e); }
          }, { passive: true });
        });
      }

      // expose reposition helper for external calls
      window.__ameba_reposition_sat_rail = positionRail;

      // start
      placeInitialRestingPositions();
      lastT = now();
      animateLoop();
      bindClicks();

      // reposition whenever hub changes or on resize
      document.addEventListener("hub-platform-changed", () => { schedulePositionRail(); });
      window.addEventListener("resize", schedulePositionRail);
    });
  })();

  /* ----------------------
     Preview hover + import wiring run once
     ---------------------- */
  (function HelpersBootstrap(){
    document.addEventListener('DOMContentLoaded', () => {
      wireImportIcons();
      wirePreviewHover();
      // move rail overlay after DOM fully painted
      attachRailAsOverlay();
      // initial position
      setTimeout(() => { if (typeof window.__ameba_reposition_sat_rail === 'function') window.__ameba_reposition_sat_rail(); }, 160);
    }, { once: true });
  })();

  /* ----------------------
     Boot: upload/convert wiring
     ---------------------- */
  function boot() {
    try {
      initUpload();
      initImportIcons();
      initConvert();
      log("Ameba boot complete (overlay sat rail enabled)");
    } catch (e) { err("boot error:", e); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

})();





























