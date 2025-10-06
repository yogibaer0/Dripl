/* Dripl – sweep cursor: movement only (no trail edits) */
/* This version assumes your DOM still has:
   - <div class="glow-line"><svg id="glowSVG"><path id="driplGlowPath" ... /></svg><div id="sweepCursor"></div></div>
*/

(function initDriplSweep(){
  const wrap   = document.querySelector('.glow-line');
  const svg    = document.getElementById('glowSVG');
  const path   = document.getElementById('driplGlowPath');
  const cursor = document.getElementById('sweepCursor');

  if (!wrap || !svg || !path || !cursor) {
    console.warn('[dripl] sweep init: missing element(s)', {wrap: !!wrap, svg: !!svg, path: !!path, cursor: !!cursor});
    return;
  }

  // cancel any previous loop so we never “freeze”
  if (window.__driplSweepCancel) window.__driplSweepCancel();

  let len = path.getTotalLength();
  let t = 0, dir = 1;
  let raf = null;

  // tuning
  const SPEED = 0.012;   // ↑ faster, ↓ slower
  const EPS   = 0.25;    // small step ahead to compute tangent angle
  const Y_NUDGE_PX = -1; // tiny vertical adjust so it hugs the stroke visually

  function measure(){
    len = path.getTotalLength();
  }

  function tick(){
    t += dir * SPEED;
    if (t >= 1) { t = 1; dir = -1; }     // ping-pong. For one-way: set t=0; dir=1;
    if (t <= 0) { t = 0; dir =  1; }

    const L  = len * t;
    const p  = path.getPointAtLength(L);
    const p2 = path.getPointAtLength(Math.min(len, L + EPS));

    // map SVG viewBox (0..100 by 0..24) to on-screen pixels
    const box = wrap.getBoundingClientRect();
    const w = svg.clientWidth  || box.width;
    const h = svg.clientHeight || 28;

    const x = box.left + (p.x / 100) * w;
    const y = box.top  + (p.y / 24 ) * h + Y_NUDGE_PX;

    // tangent angle
    const angle = Math.atan2(p2.y - p.y, p2.x - p.x);

    // place the head at (x,y) and rotate around its head pivot
    cursor.style.transform = `translate(${x}px, ${y}px) rotate(${angle}rad)`;

    raf = requestAnimationFrame(tick);
  }

  // keep sizes fresh
  const ro = new ResizeObserver(measure);
  ro.observe(svg);

  // allow hot-reinit
  window.__driplSweepCancel = () => { if (raf) cancelAnimationFrame(raf); ro.disconnect(); };

  measure();
  raf = requestAnimationFrame(tick);
})();














