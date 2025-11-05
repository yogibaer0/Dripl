/* ==========================================================================
   AMEBA — CSS patch (fixed satellites as hover nodes, stabilized top panel layout)
   - Satellites are fixed hover nodes outside the hub border (no orbit)
   - Top-row panels are equal width and stable
   - Destination hub owns its size (min sizes + content-driven)
   - Upload dropzone glow and Import goo visuals preserved
   ========================================================================== */

/* Theme tokens */
:root{
  --bg:#0b0b12;
  --panel-1:#161625; --panel-2:#1b1b2e;
  --border:#262640; --text:#e8e7ff;
  --brand-2:#8b5cf6;
  --radius:16px; --radius-sm:10px;
  --gap:22px; --space:18px;
  --sat-size:60px; --sat-gap:16px;
}

/* Base */
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;color:var(--text);font:14px/1.45 ui-sans-serif,system-ui,Segoe UI,Roboto,Inter,sans-serif;background:radial-gradient(1200px 500px at 50% -250px,#201b37 0,var(--bg) 40%),var(--bg)}
.sr-only{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}

/* Panels grid */
.shell{max-width:1100px;margin:18px auto 120px;padding:0 var(--space)}
.panels{
  display:grid;
  gap:var(--gap);
  grid-template-columns:repeat(3,1fr); /* equal top columns */
  grid-template-areas:"upload import storage" "dest dest dest";
  position:relative;
  align-items:start;
}

/* Card */
.card{
  background:linear-gradient(180deg,var(--panel-1) 0%,var(--panel-2) 100%);
  border:1px solid var(--border);
  border-radius:var(--radius);
  box-shadow:0 8px 24px rgba(0,0,0,.35);
  overflow:hidden;
  display:flex;
  flex-direction:column;
}
.card__head{display:flex;align-items:center;justify-content:space-between;padding:16px var(--space);border-bottom:1px solid var(--border)}
.card__body{padding:var(--space);display:flex;flex-direction:column;gap:12px}

/* Top panels sizing */
.panel--upload{grid-area:upload;min-height:420px}
.panel--import{grid-area:import;min-height:320px}
.panel--storage{grid-area:storage;min-height:320px;position:relative}

/* Upload */
.upload .dropzone{
  display:flex;align-items:center;justify-content:center;min-height:180px;
  border:2px dashed rgba(132,98,255,.25);
  border-radius:12px; background:linear-gradient(180deg, rgba(255,255,255,.01), rgba(255,255,255,.01));
  padding:18px; transition:box-shadow .22s, border-color .18s;
  cursor:pointer;
}
.upload .dropzone__hint{color:rgba(255,255,255,.65);text-align:center}
.upload .dropzone--over, .upload .dropzone:hover{
  border-color:var(--brand-2);
  box-shadow:0 10px 36px rgba(139,92,246,.18), inset 0 0 14px rgba(139,92,246,.06);
  background: radial-gradient(circle at center, rgba(139,92,246,.06), rgba(0,0,0,0) 60%);
}
.upload .upload__controls{display:flex;gap:10px;align-items:center;margin-top:10px;flex-wrap:wrap}
.upload .input{flex:1 1 60%;background:#141427;border:1px solid var(--border);padding:.55rem .7rem;border-radius:10px;color:var(--text);min-width:0}
.upload .select{flex:0 0 140px;background:#141427;border:1px solid var(--border);padding:.45rem;border-radius:10px;color:var(--text)}
.upload .btn--primary{display:inline-block;padding:.55rem .9rem;border-radius:10px;background:linear-gradient(180deg,var(--brand-2) 0,#7c3aed 100%);border:0;color:#fff}

/* Import goo */
.panel--import .goo-container{margin-top:auto;min-height:220px;border-radius:14px;position:relative;overflow:visible;background:linear-gradient(180deg,#12051c 0%,#1a0f27 100%);padding:18px;box-shadow:inset 0 -40px 80px rgba(18,6,20,.45)}
.goo-bg{position:absolute;left:0;top:0;right:0;bottom:0;z-index:0;pointer-events:none;background:linear-gradient(180deg, rgba(139,92,246,.06), rgba(0,0,0,0) 40%);border-radius:12px}
.icon-row{position:absolute;left:16px;right:16px;bottom:16px;display:flex;justify-content:center;gap:18px;z-index:12;pointer-events:none}
.import-icon{pointer-events:auto;width:56px;height:56px;border-radius:14px;display:grid;place-items:center;border:0;background:rgba(255,255,255,.05);color:#E6D9FF;box-shadow:0 6px 18px rgba(0,0,0,.36);transition:transform .18s,box-shadow .18s,background .18s}
.import-icon:hover,.import-icon:focus{transform:translateY(-6px);background:rgba(255,255,255,.10);box-shadow:0 18px 36px rgba(0,0,0,.48);outline:none}
.import-icon .icon{width:28px;height:28px}

/* Destination hub (main panel) */
.dest-panel{
  display:grid;
  grid-template-columns:420px minmax(420px,1fr);
  gap:24px;
  padding:16px;
  border-radius:14px;
  background:#14131a;
  border:1px solid rgba(255,255,255,.06);
  grid-column:1 / span 3;
  position:relative;
  overflow:visible;
  min-width:720px;
  min-height:360px;
}

/* Preview box - visible halo on hover */
.preview-wrap{width:360px;max-width:100%;aspect-ratio:1/1;position:relative;border-radius:14px;background:radial-gradient(120% 120% at 20% 10%,#1a1921,#0f0f14);border:1px dashed rgba(132,98,255,.35);box-shadow:inset 0 0 0 1px rgba(132,98,255,.15),0 10px 30px rgba(0,0,0,.35);overflow:visible}
.preview-wrap:hover,.preview-wrap.is-hovering{box-shadow:0 14px 40px rgba(131,94,255,.26),inset 0 0 22px rgba(131,94,255,.18);border-color:rgba(164,129,255,.95)}

/* Satellites: overlay-only fixed hover nodes (no orbit) */
.dest-sat-rail{position:absolute;pointer-events:none;z-index:30;transform:translateZ(0)}
.dest-sat-stack{position:relative;width:var(--sat-size)}
.satellite{width:var(--sat-size);height:var(--sat-size);border-radius:999px;background:rgba(255,255,255,.06);box-shadow:0 10px 24px rgba(0,0,0,.35);pointer-events:auto;transition:transform .18s,box-shadow .18s,opacity .18s}
.satellite:hover{transform:translateY(-6px) scale(1.03);box-shadow:0 20px 40px rgba(0,0,0,.5)}
.satellite.is-active{z-index:120;box-shadow:0 18px 36px rgba(0,0,0,.55),0 0 0 2px rgba(138,92,246,.28)}
.satellite.is-parking{z-index:100;opacity:.98;transform:scale(.98)}

.icon-row{z-index:60}
.preview-wrap{z-index:80}

/* Responsive fallback */
@media (max-width:1100px){
  .panels{grid-template-columns:1fr;grid-template-areas:"upload" "import" "storage" "dest"}
  .dest-panel{grid-template-columns:1fr;min-width:0}
  .icon-row{position:static;margin-top:12px}
  .upload .upload__controls{flex-direction:column;align-items:stretch}
  .upload .select{flex:1 1 auto}
  .dest-sat-rail{position:static;margin-top:18px}
}

/* End */























