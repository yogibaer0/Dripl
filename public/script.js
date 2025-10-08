// Accordion: one-open-at-a-time, expanded tab spans full row

const tabs = Array.from(document.querySelectorAll('.tab'));
const buttons = tabs.map(t => t.querySelector('.tab__button'));
const grid = document.querySelector('.tabs-grid');

function setExpanded(tab, on) {
  tab.setAttribute('aria-expanded', String(on));
  tab.classList.toggle('expanded', on);
}

function closeAll() {
  tabs.forEach(t => setExpanded(t, false));
  grid?.classList.remove('has-open');
  document.documentElement.style.setProperty('--hub-shift', '0px');
}

function openOnly(tab) {
  tabs.forEach(t => setExpanded(t, t === tab));
  grid?.classList.add('has-open');
  document.documentElement.style.setProperty('--hub-shift', '28px');
}

buttons.forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.closest('.tab');
    const isOpen = tab.getAttribute('aria-expanded') === 'true';
    isOpen ? closeAll() : (openOnly(tab), tab.scrollIntoView({behavior:'smooth', block:'start'}));
  });
});

// ESC closes
window.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });

// start closed
closeAll();

























