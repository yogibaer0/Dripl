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

// === Pixel-perfect sweep: head + fluid trail on the same SVG path ===
(function(){
  const svg   = document.getElementById('glowSVG');
  const path  = document.getElementById('driplGlowPath');
  const head  = document.getElementById('sweepHead');
  let   trail = document.getElementById('trailPath');
  if (!svg || !path || !head) return;

  // ensure a trail exists even if markup missed it
  if (!trail) {
    trail = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    trail.setAttribute('id','trailPath');
    trail.setAttribute('class','trail');
    trail.setAttribute('fill','none');
    trail.setAttribute('d', path.getAttribute('d'));
    svg.appendChild(trail);
  }

  // cancel any previous sweep to avoid frozen states
  if (window.__driplSweepCancel) window.__driplSweepCancel();

  let len = path.getTotalLength();
  let t = 0, dir = 1;
  const SPEED = 0.012;         // feel
  const TRAIL_FRAC = 0.12;     // length of lit segment (8–18% looks good)

  // prepare trail dash pattern
  function prepareDash(){
    len = path.getTotalLength();
    const seg = Math.max(2, len * TRAIL_FRAC);
    trail.setAttribute('stroke-dasharray', `${seg} ${len}`);
  }

  function tick(){
    t += dir * SPEED;
    if (t >= 1) { t = 1; dir = -1; }   // ping-pong
    if (t <= 0) { t = 0; dir =  1; }

    const L = len * t;
    const p = path.getPointAtLength(L);

    // head exactly on path pixels
    head.setAttribute('cx', p.x);
    head.setAttribute('cy', p.y);

    // fluid trail: show a window ending at the head
    trail.setAttribute('stroke-dashoffset', `${Math.max(0, len - L)}`);

    raf = requestAnimationFrame(tick);
  }

  // keep a handle to stop on hot reloads or reinit
  let raf = null;
  const ro = new ResizeObserver(()=>{ prepareDash(); });
  ro.observe(svg);

  function cancel(){ if (raf) cancelAnimationFrame(raf); ro.disconnect(); }
  window.__driplSweepCancel = cancel;

  prepareDash();
  raf = requestAnimationFrame(tick);
})();













