// public/script.js
// Dripl UI script — safe to paste over your existing file

(() => {
  'use strict';

  // ---- element helpers ----
  const $ = (id) => document.getElementById(id);

  document.addEventListener('DOMContentLoaded', () => {
    const form    = $('convertForm');
    const urlEl   = $('url');
    const fmtEl   = $('format');
    const btn     = $('convertBtn');
    const resEl   = $('result');
    const yearEl  = $('year');
    const particlesHost = $('particles');

    // Footer year
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // Health ping (non-blocking)
    fetch('/api/health').catch(() => { /* ignore */ });

    // Allow Enter to submit from URL field
    if (urlEl && form) {
      urlEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          form.requestSubmit ? form.requestSubmit() : form.submit();
        }
      });
    }

    // Main submit handler (robust)
    if (form && urlEl && fmtEl && btn && resEl) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const url = (urlEl.value || '').trim();
        const format = (fmtEl.value || 'mp3').toLowerCase();

        if (!url) {
          resEl.textContent = 'Enter a URL';
          urlEl.focus();
          return;
        }

        btn.disabled = true;
        resEl.textContent = 'Working...';

        try {
          const r = await fetch('/api/auto', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, format })
          });

          let data = {};
          try { data = await r.json(); } catch (_) {}

          if (!r.ok) {
            // show friendly server message if provided
            const msg = (data && data.error) ? data.error : `HTTP ${r.status}`;
            throw new Error(msg);
          }

          if (!data || !data.url) {
            throw new Error('No file returned. Try another link.');
          }

          // Success UI
          const fileUrl = data.url;
          const label = fileUrl.split('/').pop() || 'Download';
          resEl.innerHTML = `
            <a class="download" href="${fileUrl}" download rel="noopener">
              ${label}
            </a>`;
          // If you want to clear URL on success, uncomment:
          // urlEl.value = '';
        } catch (err) {
          console.error('[dripl] submit error:', err);
          resEl.textContent = String(err?.message || err || 'Unexpected error');
        } finally {
          btn.disabled = false;
        }
      });
    } else {
      console.warn('[dripl] Missing expected form elements');
    }

    // ---- Optional: tiny particle/ripple layer (safe if #particles missing) ----
    if (particlesHost) {
      particlesHost.style.position = 'fixed';
      particlesHost.style.inset = '0';
      particlesHost.style.pointerEvents = 'none';
      particlesHost.style.overflow = 'hidden';
      spawnInitialDroplets(particlesHost);
      setInterval(() => spawnDroplet(particlesHost), 900);
    }
  });

  // ---------------- particles (fun, non-essential) ----------------
  function spawnInitialDroplets(host) {
    for (let i = 0; i < 10; i++) spawnDroplet(host, true);
  }

  function spawnDroplet(host, initial = false) {
    const d = document.createElement('span');
    d.className = 'drop';
    const size = 6 + Math.random() * 12; // px
    const dur = 4 + Math.random() * 5;   // seconds
    const left = Math.random() * 100;    // vw
    const top = initial ? (10 + Math.random() * 70) : -5; // vh

    // inline styles to avoid relying on CSS file
    d.style.position = 'absolute';
    d.style.width = `${size}px`;
    d.style.height = `${size}px`;
    d.style.left = `${left}vw`;
    d.style.top = `${top}vh`;
    d.style.borderRadius = '50%';
    d.style.background = 'radial-gradient(circle at 30% 30%, #9a7bff, #4b2aac)';
    d.style.opacity = '0.25';
    d.style.boxShadow = '0 0 0 rgba(145,167,255,0.25)';
    d.style.transition = `transform ${dur}s linear, opacity 1s ease`;

    host.appendChild(d);

    // animate down + fade
    requestAnimationFrame(() => {
      d.style.transform = 'translateY(105vh)';
      d.style.opacity = '.18';
    });

    // slight ripple at end
    setTimeout(() => {
      d.style.boxShadow = '0 0 12px rgba(145,167,255,0.25)';
    }, (dur - 0.2) * 1000);

    // cleanup
    setTimeout(() => {
      d.remove();
    }, dur * 1000 + 800);
  }
})();

