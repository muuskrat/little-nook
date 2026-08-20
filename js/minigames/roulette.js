// "Lucky Spin" mini-game: a roulette wheel that pays out food, a drink, or
// coins — and rarely a jackpot cosmetic/decoration. The wheel only knows
// about category *slices*, not specific items — which item actually comes
// out of the food/water/jackpot slices is picked fresh from the current
// catalog each spin (see items.js), so adding new food/water/decoration/
// cosmetic items to items.js later automatically expands what this game
// can award. Nothing here needs to change for that.

import { itemsByCategory } from '../items.js';
import { renderIcon } from '../ui.js';

const MONEY_MIN = 6;
const MONEY_MAX = 24;
const JACKPOT_FALLBACK_COINS = 100; // paid instead if every jackpot-eligible item is already owned
// Any of these categories can turn up in the jackpot slice — add a new
// customization category here (say, a future "hat" slot) and it's in the
// jackpot pool immediately.
const JACKPOT_CATEGORIES = ['decoration', 'body', 'hair', 'ears', 'room'];
const SPIN_MS = 3600;

// Weight controls both the wheel's visual slice size and the actual odds —
// change a number here and both stay in sync automatically.
// --sand and --food-color are the exact same hex value in this palette, so
// money uses --health-color instead — otherwise the food and money slices
// would be visually indistinguishable on the wheel.
const SEGMENTS = [
  { type: 'food', label: 'Food', icon: '🍽️', weight: 3, color: 'var(--food-color)' },
  { type: 'water', label: 'Drink', icon: '💧', weight: 3, color: 'var(--water-color)' },
  { type: 'money', label: 'Coins', icon: '🪙', weight: 3, color: 'var(--health-color)' },
  { type: 'jackpot', label: 'JACKPOT', icon: '🎉', weight: 1, color: 'var(--pink-deep)' },
];

function withRanges(segments) {
  const total = segments.reduce((sum, s) => sum + s.weight, 0);
  let acc = 0;
  return segments.map((seg) => {
    const startPct = (acc / total) * 100;
    acc += seg.weight;
    const endPct = (acc / total) * 100;
    const mid = ((startPct + endPct) / 2 / 100) * 360;
    return { ...seg, startPct, endPct, mid };
  });
}

function pickWeighted(ranges) {
  const total = ranges.reduce((sum, s) => sum + s.weight, 0);
  let r = Math.random() * total;
  for (const seg of ranges) {
    if (r < seg.weight) return seg;
    r -= seg.weight;
  }
  return ranges[ranges.length - 1];
}

// Resolves a landed-on slice into an actual, specific prize. `state` is
// read (never mutated) here — applyPrize() below does the mutating — so
// this stays easy to reason about independently.
function resolvePrize(segment, state) {
  if (segment.type === 'money') {
    const coins = MONEY_MIN + Math.floor(Math.random() * (MONEY_MAX - MONEY_MIN + 1));
    return { coins, icon: '🪙', text: `+${coins} coins!` };
  }
  if (segment.type === 'food' || segment.type === 'water') {
    const pool = itemsByCategory(segment.type);
    const item = pool[Math.floor(Math.random() * pool.length)];
    return { inventoryItemId: item.id, icon: item.icon, text: `A free ${item.name}!` };
  }
  // jackpot
  const candidates = JACKPOT_CATEGORIES.flatMap((c) => itemsByCategory(c)).filter((i) => !state.owned.includes(i.id));
  if (candidates.length === 0) {
    return { coins: JACKPOT_FALLBACK_COINS, icon: '🪙', text: `You already own everything — +${JACKPOT_FALLBACK_COINS} coins instead!` };
  }
  const item = candidates[Math.floor(Math.random() * candidates.length)];
  return { ownItemId: item.id, icon: item.icon, text: `${item.name}, yours for free!` };
}

function applyPrize(store, prize) {
  if (prize.coins) store.state.money += prize.coins;
  if (prize.inventoryItemId) store.state.inventory[prize.inventoryItemId] = (store.state.inventory[prize.inventoryItemId] || 0) + 1;
  if (prize.ownItemId) store.state.owned.push(prize.ownItemId);
  store.persist();
}

export function mountRouletteGame(container, { store, onEnd }) {
  const ranges = withRanges(SEGMENTS);
  const gradient = ranges.map((s) => `${s.color} ${s.startPct}% ${s.endPct}%`).join(', ');

  container.innerHTML = `
    <div class="game-hud">
      <span>🎡 One spin — food, a drink, coins, or the jackpot!</span>
    </div>
    <div class="roulette-stage">
      <div class="roulette-pointer"></div>
      <div class="roulette-wheel" id="roulette-wheel" style="background: conic-gradient(${gradient});">
        ${ranges.map((s) => `<span class="roulette-seg-label" style="transform: rotate(${s.mid}deg) translateY(-62px);">${renderIcon(s.icon)}</span>`).join('')}
      </div>
    </div>
    <button class="primary-btn" id="roulette-spin">Spin!</button>
  `;

  const wheel = container.querySelector('#roulette-wheel');
  const spinBtn = container.querySelector('#roulette-spin');

  spinBtn.addEventListener('click', () => {
    spinBtn.disabled = true;
    const winner = pickWeighted(ranges);
    const fullSpins = 6;
    const rotation = fullSpins * 360 + ((360 - winner.mid) % 360);
    wheel.style.transform = `rotate(${rotation}deg)`;
    setTimeout(() => {
      const prize = resolvePrize(winner, store.state);
      applyPrize(store, prize);
      showResult(winner, prize);
    }, SPIN_MS);
  });

  function showResult(winner, prize) {
    const overlay = document.createElement('div');
    overlay.className = 'game-overlay-msg';
    overlay.innerHTML = `
      <div style="font-size:32px;">${renderIcon(prize.icon)}</div>
      <div><strong>${winner.type === 'jackpot' ? '🎉 JACKPOT! ' : ''}${prize.text}</strong></div>
      <button class="primary-btn" id="roulette-collect">Collect</button>
    `;
    container.style.position = 'relative';
    container.appendChild(overlay);
    document.getElementById('roulette-collect').addEventListener('click', () => onEnd(0, prize.text));
  }
}
