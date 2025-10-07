/* Dripl – sweep cursor: movement only (no trail edits) */
/* This version assumes your DOM still has:
   - <div class="glow-line"><svg id="glowSVG"><path id="driplGlowPath" ... /></svg><div id="sweepCursor"></div></div>
*/

(function initDriplSweep(){
  const wrap   = document.querySelector('.glow-line');
  const svg    = document.getElementById('glowSVG');
  const path   = document.getElementById('driplGlowPath');
  const cursor = document.getElementById('sweepCursor');
  const trail  = document.getElementById('trailPath');  // NEW

  if (!wrap || !svg || !path || !cursor || !trail) {
    console.warn('[dripl] sweep init: missing el(s)');
    return;
  }

  if (window.__driplSweepCancel) window.__driplSweepCancel();

  let len = path.getTotalLength();
  let t = 0, dir = 1;
  let raf = null;

  const SPEED = 0.012;
  const EPS   = 0.25;
  const Y_NUDGE_PX = -1;

  const TRAIL_FRAC = 0.12;   // 12% of path glows; tweak 0.08..0.18 to taste

  function measure(){
    len = path.getTotalLength();
    const seg = Math.max(2, len * TRAIL_FRAC);               // visible minimum
    trail.setAttribute('stroke-dasharray', `${seg} ${len}`);  // prep once/resize
  }

  function tick(){
    t += dir * SPEED;
    if (t >= 1) { t = 1; dir = -1; }
    if (t <= 0) { t = 0; dir =  1; }

    const L  = len * t;
    const p  = path.getPointAtLength(L);
    const p2 = path.getPointAtLength(Math.min(len, L + EPS));

    // map SVG -> screen for the HTML cursor
    const box = wrap.getBoundingClientRect();
    const w = svg.clientWidth  || box.width;
    const h = svg.clientHeight || 28;
    const x = box.left + (p.x / 100) * w;
    const y = box.top  + (p.y / 24 ) * h + Y_NUDGE_PX;

    const angle = Math.atan2(p2.y - p.y, p2.x - p.x);
    cursor.style.transform = `translate(${x}px, ${y}px) rotate(${angle}rad)`;

    // fluid on-path trail: window that ends at the head
    trail.setAttribute('stroke-dashoffset', `${Math.max(0, len - L)}`);

    raf = requestAnimationFrame(tick);
  }

  const ro = new ResizeObserver(measure);
  ro.observe(svg);

  window.__driplSweepCancel = () => { if (raf) cancelAnimationFrame(raf); ro.disconnect(); };

  measure();
  raf = requestAnimationFrame(tick);
})();















