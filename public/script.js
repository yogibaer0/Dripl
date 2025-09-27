// script.js for Dripl
const form = document.getElementById('convertForm');
const urlInput = document.getElementById('url');
const formatSelect = document.getElementById('format');
const resultBox = document.getElementById('result');

form.addEventListener('submit', async (e) => {
  e.preventDefault(); // stop browser GET submit

  const url = urlInput.value.trim();
  const format = formatSelect.value;
  if (!url) {
    resultBox.textContent = '⚠️ Please enter a link.';
    return;
  }

  resultBox.textContent = '⏳ Working…';

  try {
    const res = await fetch('/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, format })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // server.js returns error + message keys
      resultBox.textContent = `❌ ${data.message || data.error || 'Unknown error'}`;
      console.error('[dripl] fail', data);
      return;
    }

    // show a clickable link
    resultBox.innerHTML = `✅ Ready: <a href="${data.file}" download>download ${format.toUpperCase()}</a>`;
  } catch (err) {
    resultBox.textContent = `⚠️ Network error: ${err.message}`;
    console.error('[dripl] network', err);
  }
});



