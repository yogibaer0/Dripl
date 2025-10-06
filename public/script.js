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
  const wrap = document.querySelector('.glow-line');
  const svg  = document.getElementById('glowSVG');
  const path = document.getElementById('driplGlowPath');
  const cursor = document.getElementById('sweepCursor');
  if(!wrap || !svg || !path || !cursor) return;

  let len = path.getTotalLength();
  let t = 0;                      // 0..1 along path
  let dir = 1;                    // 1 = forward, -1 = backward

  const SPEED = 0.012;            // increase for faster sweep
  const EPS   = 0.25;             // small step to compute tangent angle
  const Y_NUDGE_PX = -1;          // micro vertical nudge if needed

  function measure(){ len = path.getTotalLength(); }

  function tick(){
    t += dir * SPEED;
    if (t >= 1) { t = 1; dir = -1; }        // ping-pong; for one-way EKG: set to t=0; dir=1;
    if (t <= 0) { t = 0; dir =  1; }

    const L  = len * t;
    const p  = path.getPointAtLength(L);
    const p2 = path.getPointAtLength(Math.min(len, L + EPS));  // ahead along path

    // map SVG viewBox (0..100, 0..24) to screen
    const wrapBox = wrap.getBoundingClientRect();
    const w = svg.clientWidth  || wrapBox.width;
    const h = svg.clientHeight || 28;
    const x = wrapBox.left + (p.x  / 100) * w;
    const y = wrapBox.top  + (p.y  / 24 ) * h + Y_NUDGE_PX;

    // angle tangent to the path
    const angle = Math.atan2(p2.y - p.y, p2.x - p.x);

    cursor.style.transform =
      `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${angle}rad)`;

    requestAnimationFrame(tick);
  }

  const ro = new ResizeObserver(measure);
  ro.observe(svg);

  measure();
  tick();
})();












