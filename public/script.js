// script.js — Dripl (front-end) aligned to /api/download + /api/probe
const form = document.getElementById('convertForm');
const urlInput = document.getElementById('url');
const formatSelect = document.getElementById('format');
const resultBox = document.getElementById('result');

// optional: current year in footer if you use <span id="year"></span>
const y = document.getElementById('year');
if (y) y.textContent = new Date().getFullYear();

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

// (Optional) Example of probing without download:
window.driplProbe = async function (url) {
  const res = await fetch('/api/probe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  return res.json();
};




