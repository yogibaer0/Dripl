// public/script.js

document.addEventListener('DOMContentLoaded', () => {
  console.log('[dripl] boot');

  const form   = document.getElementById('convertForm');
  const urlEl  = document.getElementById('url');
  const fmtEl  = document.getElementById('format');
  const resEl  = document.getElementById('result');
  const btnEl  = document.getElementById('convertBtn');

  if (!form || !urlEl || !fmtEl || !resEl || !btnEl) {
    console.error('[dripl] Missing expected form elements');
    return;
  }
  console.log('[dripl] elements wired');

  const submit = async (e) => {
    e?.preventDefault?.();
    const url = (urlEl.value || '').trim();
    const format = (fmtEl.value || 'mp3').toLowerCase();

    if (!url) {
      resEl.textContent = '⚠️ Enter a URL';
      return;
    }

    resEl.textContent = '⏳ Working...';
    console.log('[dripl] POST /api/auto', { url, format });

    try {
      const r = await fetch('/api/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, format }),
      });

      // try to read JSON even on error status
      let data = null;
      try { data = await r.json(); } catch {}

      if (!r.ok || !data?.ok) {
        throw new Error(data?.error || r.statusText || 'Conversion failed');
      }

      resEl.innerHTML =
        `✅ Done! <a href="${data.url}" download>Download ${format.toUpperCase()}</a>`;
      console.log('[dripl] success', data);

    } catch (err) {
      console.error('[dripl] submit error:', err);
      resEl.textContent = `❌ Error: ${err?.message || String(err)}`;
    }
  };

  form.addEventListener('submit', submit);
  btnEl.addEventListener('click', submit);
  urlEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') form.requestSubmit();
  });
});
