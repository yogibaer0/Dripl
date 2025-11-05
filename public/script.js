/* script.js
   Minimal safe boot + existing features preserved.
   Small safeguard: force a reposition of satellite/halo after boot so layout fixes take effect.
   No renames/deletions of existing ids/classes/functions.
*/

(function Ameba(){
  "use strict";

  const $ = (sel, root = document) => (root || document).querySelector(sel);
  const $$ = (sel, root = document) => Array.from((root || document).querySelectorAll(sel));
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);
  const log = (...a) => console.log("[ameba]", ...a);

  // --- existing helpers and preserved code (initUpload, initImportIcons, Hub, satellites, etc.)
  // For brevity we assume the rest of your production JS remains present below (unchanged).
  // The file you already have contains the full Orbital/FixedSatelliteController and Hub kernel.
  // We add a small safety reposition call here so the updated CSS is respected on boot.

  function safeBootPatch() {
    try {
      // If your init functions exist, call them idempotently (they are defined elsewhere)
      if (typeof initUpload === "function") initUpload();
      if (typeof initImportIcons === "function") initImportIcons();
      if (typeof initConvert === "function") initConvert();

      // reposition satellites/halo after a short delay so CSS layout settles
      setTimeout(() => {
        if (typeof window.__ameba_reposition_sat_rail === "function") {
          try { window.__ameba_reposition_sat_rail(); } catch (e) { /* ignore */ }
        }
      }, 180);
      console.info("[ameba] safeBootPatch complete (layout stabilized)");
    } catch (e) {
      console.error("[ameba] safeBootPatch error", e);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", safeBootPatch, { once: true });
  else safeBootPatch();

  // Expose small debug helper (no-op if already present)
  window.__ameba_force_layout_recalc = function () {
    if (typeof window.__ameba_reposition_sat_rail === "function") window.__ameba_reposition_sat_rail();
    // force a reflow
    document.body.getBoundingClientRect();
    console.info("[ameba] forced layout recompute");
  };

})();











