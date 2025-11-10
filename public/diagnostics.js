/* diagnostics.js — lightweight state logger for Ameba satellites/hub */
export default {
  logState(satSel = '.dest-sat-rail .satellite', hubSel = '.dest-panel') {
    try {
      const sats = Array.from(document.querySelectorAll(satSel));
      const hub  = document.querySelector(hubSel);
      const hubRect = hub?.getBoundingClientRect() || { left:0, top:0, width:0, height:0 };

      const rows = sats.map((el, i) => {
        const r = el.getBoundingClientRect();
        const x = (r.left + r.width/2)  - (hubRect.left + hubRect.width/2);
        const y = (r.top  + r.height/2) - (hubRect.top  + hubRect.height/2);
        const angle  = Math.atan2(y, x);                  // rad
        const radius = Math.hypot(x, y);                  // px
        return {
          i,
          id: el.id || (el.dataset.platform ?? '—'),
          platform: el.dataset.platform ?? '—',
          x: Math.round(r.left + window.scrollX),
          y: Math.round(r.top  + window.scrollY),
          angle: +angle.toFixed(3),
          radius: +radius.toFixed(2),
          w: Math.round(r.width),
          h: Math.round(r.height)
        };
      });

      console.groupCollapsed(`[diag] hub (${Math.round(hubRect.width)}×${Math.round(hubRect.height)}) @ ${Math.round(hubRect.left)},${Math.round(hubRect.top)}`);
      console.table(rows);

      // quick overlap check
      const overlaps = [];
      for (let a = 0; a < sats.length; a++) {
        for (let b = a + 1; b < sats.length; b++) {
          const A = sats[a].getBoundingClientRect();
          const B = sats[b].getBoundingClientRect();
          const dx = (A.left + A.width/2) - (B.left + B.width/2);
          const dy = (A.top  + A.height/2) - (B.top  + B.height/2);
          const dist = Math.hypot(dx, dy);
          const min  = (Math.min(A.width, A.height) + Math.min(B.width, B.height)) / 2;
          if (!Number.isFinite(dist) || dist < min) overlaps.push({ a, b, dist: +dist.toFixed(1), min: +min.toFixed(1) });
        }
      }
      if (overlaps.length) console.warn('[diag] overlaps', overlaps);
      console.groupEnd();
    } catch (e) {
      console.error('[diag] error', e);
    }
  }
}
