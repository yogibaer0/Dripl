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

// === Glow dot animation along SVG path (SVG coordinates; no screen mapping) ===
(function(){
  const svg  = document.getElementById('glowSVG');
  const path = document.getElementById('driplGlowPath');
  const dot  = document.getElementById('glowDotSvg');
  if(!svg || !path || !dot) return;

  let len = path.getTotalLength();
  let t = 0, dir = 1;

  function tick(){
    // speed: bump number for faster travel
    t += dir * 0.008;                 // was 0.006
    if (t >= 1) { t = 1; dir = -1; }  // ping–pong
    if (t <= 0) { t = 0; dir =  1; }

    const p = path.getPointAtLength(len * t);
    // place the circle in the SAME coordinate system as the SVG (0..100, 0..24)
    dot.setAttribute('cx', p.x);
    dot.setAttribute('cy', p.y);

    requestAnimationFrame(tick);
  }

  // if the SVG rescales, length is unchanged (viewBox), but re-measure anyway
  const ro = new ResizeObserver(() => { len = path.getTotalLength(); });
  ro.observe(svg);

  tick();
})();








