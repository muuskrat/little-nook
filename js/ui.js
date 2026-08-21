// Small DOM helpers shared across features: meters, toast, modal, speech bubble.

import { STAT_KEYS, meterEffectDescriptions, meterRatePerMin } from './state.js';

// Mirrors the thresholds elsewhere that already treat a stat as "critical"
// (state.js's own lowCount check uses 25) / "maxed out" — drives both the
// meter's visual low/high treatment (see .meter.stat-low/.stat-high in
// css/style.css) and its own line in the tooltip below.
const METER_LOW_THRESHOLD = 25;
const METER_HIGH_THRESHOLD = 90;

// "-0.45/min", "+4.50/min", or "steady" for anything too close to zero to
// be worth showing a sign on.
function formatRate(rate) {
  if (Math.abs(rate) < 0.005) return 'steady';
  return `${rate > 0 ? '+' : ''}${rate.toFixed(2)}/min`;
}

export function renderMeters(state) {
  for (const key of STAT_KEYS) {
    const fill = document.getElementById(`fill-${key}`);
    if (!fill) continue;
    const val = Math.round(state.stats[key]);
    fill.style.width = `${val}%`;

    // Each meter's base explainer ("Food — how full your pet is") is
    // authored once in index.html's title attribute — cache it the first
    // time so every later render can rebuild from that same base text
    // instead of duplicating it here, appending the current value/rate and
    // whatever's actively changing that rate (mood, a decoration, a messy
    // room, not being petted enough).
    const meterEl = document.querySelector(`.meter[data-stat="${key}"]`);
    if (meterEl) {
      meterEl.classList.toggle('stat-low', val < METER_LOW_THRESHOLD);
      meterEl.classList.toggle('stat-high', val >= METER_HIGH_THRESHOLD);

      if (meterEl.dataset.baseTitle === undefined) meterEl.dataset.baseTitle = meterEl.title;
      const statusLine = `${val}/100 (${formatRate(meterRatePerMin(state, key))})`;
      const extras = meterEffectDescriptions(state, key);
      meterEl.title = extras.length
        ? `${meterEl.dataset.baseTitle}\n\n${statusLine}\n\nCurrently affecting this:\n${extras.map((l) => '• ' + l).join('\n')}`
        : `${meterEl.dataset.baseTitle}\n\n${statusLine}`;
    }
  }
  document.getElementById('money-amount').textContent = state.money;
}

// Flashes the topbar coin counter gold for a moment — used alongside the
// floating "+X" particle (see showMoneyParticle() in js/room.js) for a
// coin gain that's easy to miss if you're not looking straight at the
// character, e.g. doScoldInteraction() in js/main.js.
export function pulseMoneyDisplay() {
  const el = document.getElementById('money-display');
  el.classList.remove('money-pulse');
  void el.offsetWidth; // restart the animation if a previous pulse is still finishing
  el.classList.add('money-pulse');
}

let toastTimer = null;
export function showToast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2200);
}

let bubbleTimer = null;
export function showSpeech(message) {
  const el = document.getElementById('speech-bubble');
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => el.classList.add('hidden'), 1800);
}

// `onClose`, if given, fires exactly once — whenever this modal actually
// closes, however that happens (the ✕ button, clicking the overlay, or a
// caller's own closeModal() call once its own flow finishes). Lets a modal
// that started something pausable/stateful (see openLandlordEvent() in
// js/minigames/landlord.js) clean up even if the player dismisses it
// early instead of finishing normally.
let modalCloseCallback = null;

export function openModal(innerHtmlOrNode, { onClose } = {}) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  content.innerHTML = '';
  if (typeof innerHtmlOrNode === 'string') {
    content.innerHTML = innerHtmlOrNode;
  } else {
    content.appendChild(innerHtmlOrNode);
  }
  overlay.classList.remove('hidden');
  modalCloseCallback = onClose || null;
}

export function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-content').innerHTML = '';
  // Cleared before invoking so a callback that itself calls closeModal()
  // (the normal "finished, collect reward, close" flow) can't re-fire it.
  const cb = modalCloseCallback;
  modalCloseCallback = null;
  if (cb) cb();
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'modal-overlay') closeModal();
});

// The one-time-per-session win screen (see the trophy button in
// js/shop.js) — a separate, higher-z-index overlay from the regular
// modal so it can show up on top of the shop without closing it, and
// dismisses on a click anywhere rather than needing a dedicated close
// button.
export function showWinScreen() {
  document.getElementById('win-overlay').classList.remove('hidden');
}
export function hideWinScreen() {
  document.getElementById('win-overlay').classList.add('hidden');
}
document.getElementById('win-overlay').addEventListener('click', hideWinScreen);

// Renders an item's icon. Today many icons are emoji placeholders; once you
// have hand-drawn icons, point `icon` at an image path (e.g. "assets/items/apple.png")
// and this function will render an <img> instead automatically. Sized in
// `em` (relative to the containing element's font-size) rather than a fixed
// pixel size, so it drops into any context that already sizes emoji via
// font-size — a 30px shop-card icon slot or a room item that scales with
// depth — without extra plumbing.
export function renderIcon(icon) {
  if (typeof icon === 'string' && /\.(png|svg|jpg|jpeg|webp)$/i.test(icon)) {
    return `<img src="${icon}" alt="" style="width:1em;height:1em;object-fit:contain;vertical-align:middle;">`;
  }
  return icon;
}
