/* --- Tabs controller (Upload, Import, Storage) --- */
(function tabs(){
  const tabs = Array.from(document.querySelectorAll('.tab[data-tab]'));
  if (!tabs.length) return;

  function setOpen(name, pushHash = true){
    tabs.forEach(sec => {
      const on = sec.dataset.tab === name;
      sec.setAttribute('aria-expanded', String(on));
    });
    if (pushHash) history.replaceState(null, '', name ? `#${name}` : ' ');
  }

  // attach button clicks
  tabs.forEach(sec => {
    const btn = sec.querySelector('.tab__button');
    if (!btn) return;
    btn.addEventListener('click', () => setOpen(sec.dataset.tab));
  });

  // open from hash or default none-open
  const fromHash = (location.hash || '').replace('#','').trim();
  if (fromHash && tabs.some(t => t.dataset.tab === fromHash)){
    setOpen(fromHash, false);
  } else {
    // start with all closed to keep equal size
    setOpen('', false);
  }

  // allow manual hash changing
  window.addEventListener('hashchange', ()=>{
    const h = (location.hash || '').replace('#','').trim();
    setOpen(h || '', false);
  });
})();

/* --- Simple stubs so existing IDs continue to work --- */
document.getElementById('convertBtn')?.addEventListener('click', () => {
  const url = document.getElementById('convertUrl')?.value?.trim();
  const fmt = document.getElementById('convertFormat')?.value || 'mp4';
  if (!url) return;
  console.log('Convert requested:', { url, fmt });
  // hook your existing conversion fetch here
});

document.getElementById('convertUrl')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('convertBtn')?.click();
});

document.getElementById('browseBtn')?.addEventListener('click', () => {
  // wire to your hidden <input type="file"> if you have one
  alert('Browse files (stub)');
});

document.getElementById('importStub')?.addEventListener('click', () => alert('Connect (stub)'));
document.getElementById('storageStub')?.addEventListener('click', () => alert('Configure (stub)'));


















