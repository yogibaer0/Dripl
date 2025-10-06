// script.js — Dripl (front-end)

// Form elements (null-safe: script keeps running even if form is missing)
const form = document.getElementById('convertForm');
const urlInput = document.getElementById('url');
const formatSelect = document.getElementById('format');
const resultBox = document.getElementById('result');

// optional: current year in footer if you use <span id="year"></span>
const y = document.getElementById('year');
if (y) y.textContent = new Date().getFullYear();

if (form && urlInput && formatSelect && resultBox) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const url = urlInput.value.trim();
    const fmt = (formatSelect.value || 'mp4').toLowerCase();
    if (!url) {
      resultBox.textContent = '⚠️ Please enter a link.';
      return;
    }

    resultBox.textContent = '⏳ Working…';

    try {
      const body = {
        url,
        audioOnly: fmt === 'mp3',
        // quality: '1080p', // uncomment if you want to force
      };

      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        try {
          const j = JSON.parse(text);
          throw new Error(j.error || j.message || text || 'Unknown server error');
        } catch {
          throw new Error(text || 'Unknown server error');
        }
      }

      const blob = await res.blob();
      const a = document.createElement('a');
      const ext = fmt === 'mp3' ? 'm4a' : 'mp4';
      a.href = URL.createObjectURL(blob);
      a.download = `dripl-${Date.now()}.${ext}`;
      a.click();
      resultBox.textContent = '✅ Done';
    } catch (err) {
      resultBox.textContent = `❌ ${err.message || err}`;
      console.error('[dripl] convert error:', err);
    }
  });

  // color cue for format
  formatSelect.addEventListener('change', () => {
    const mp = formatSelect.value.toLowerCase() === 'mp3' ? 'mp3' : 'mp4';
    formatSelect.dataset.format = mp;
  });
  formatSelect.dispatchEvent(new Event('change'));
}

// === Glowing tracer cursor (fixed-size HTML element) ===
(function(){
  const wrap   = document.querySelector('.glow-line');
  const svg    = document.getElementById('glowSVG');
  const path   = document.getElementById('driplGlowPath');
  const cursor = document.getElementById('sweepCursor');
  const trail  = document.getElementById('trailPath');   // NEW
  if(!wrap || !svg || !path || !cursor || !trail) return;

  let len = path.getTotalLength();
  let t = 0, dir = 1;

  const SPEED = 0.012;     // same as you liked
  const EPS   = 0.25;      // tangent sample for cursor rotation
  const Y_NUDGE_PX = -1;   // keeps head visually on the stroke

  // How long the illuminated segment should be (fraction of path length)
  const TRAIL_FRAC = 0.12; // 12% of the path; tweak 0.08..0.18 to taste

  function measure(){ len = path.getTotalLength(); }

  function tick(){
    t += dir * SPEED;
    if (t >= 1) { t = 1; dir = -1; }  // ping-pong
    if (t <= 0) { t = 0; dir =  1; }

    const L  = len * t;
    const p  = path.getPointAtLength(L);
    const p2 = path.getPointAtLength(Math.min(len, L + EPS));

    // map SVG -> screen using the wrapper box (your working mapping)
    const box = wrap.getBoundingClientRect();
    const w = svg.clientWidth  || box.width;
    const h = svg.clientHeight || 28;
    const x = box.left + (p.x / 100) * w;
    const y = box.top  + (p.y / 24 ) * h + Y_NUDGE_PX;

    const angle = Math.atan2(p2.y - p.y, p2.x - p.x);
    cursor.style.transform = `translate(${x}px,${y}px) rotate(${angle}rad)`;

    // --- NEW: draw a trailing segment behind the head on the SVG path ---
    const seg = Math.max(2, len * TRAIL_FRAC); // minimum few units so it’s visible
    // dasharray shows [lit-segment, remainder]; dashoffset moves it along the path
    trail.setAttribute('stroke-dasharray', `${seg} ${len}`);
    trail.setAttribute('stroke-dashoffset', `${Math.max(0, len - L)}`);
    // ---------------------------------------------------------------------

    requestAnimationFrame(tick);
  }

  new ResizeObserver(measure).observe(svg);
  measure();
  tick();
})();












