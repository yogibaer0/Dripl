// Simple one-open-at-a-time accordion that expands a card to full width.
// It also nudges the hub down a bit when any panel is open.

const panelsEl = document.getElementById('panels');
const cards = Array.from(document.querySelectorAll('.card'));
const heads = cards.map(c => c.querySelector('.card__head'));

function setExpanded(card, on) {
  // aria + class sync
  const head = card.querySelector('.card__head');
  head.setAttribute('aria-expanded', String(on));
  card.classList.toggle('open', on);
  card.querySelector('.card__body').style.display = on ? 'block' : 'none';
}

function closeAll() {
  cards.forEach(c => setExpanded(c, false));
  panelsEl.classList.remove('expanded');
  document.documentElement.style.setProperty('--hub-shift', '0px');
}

function openOnly(card) {
  cards.forEach(c => setExpanded(c, c === card));
  panelsEl.classList.add('expanded');
  document.documentElement.style.setProperty('--hub-shift', '28px');
}

heads.forEach(head => {
  head.addEventListener('click', () => {
    const card = head.closest('.card');
    const isOpen = card.classList.contains('open');
    if (isOpen) {
      closeAll();
    } else {
      openOnly(card);
      // Optional: scroll into view on small screens
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// Optional: ESC closes expanded panel
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAll();
});

// Start closed (compact)
closeAll();
























