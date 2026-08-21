// Shop modal: buy consumables (food/water/medicine), decorations (some with
// passive room bonuses), pets (placed like a decoration, but they wander
// and have their own play interactions — see js/main.js — and some
// variants only unlock once you own a specific room), character
// customization (body/hair/ears — really an outfit + hair + ears, exactly
// one of each always equipped), and which room/scenery is current.

import { ITEMS, itemsByCategory, decorEffectDescription, CONSUMABLE_CATEGORIES, CUSTOMIZATION_CATEGORIES, allCollectiblesOwned } from './items.js';
import { makeUid, allStatsAboveThreshold } from './state.js';
import { openModal, showToast, renderIcon, showWinScreen } from './ui.js';
import { renderRoomItems } from './room.js';

const TABS = [
  { key: 'food', label: '🍎 Food' },
  { key: 'water', label: '💧 Water' },
  { key: 'medicine', label: '💊 Medicine' },
  { key: 'decoration', label: '🪴 Decor' },
  { key: 'pet', label: '🐒 Pets' },
  { key: 'body', label: '👕 Outfit' },
  { key: 'hair', label: '💇 Hair' },
  { key: 'ears', label: '🐰 Ears' },
  { key: 'room', label: '🗺️ Travel' },
];

let store = null;
let activeTab = 'food';

function isConsumable(category) {
  return CONSUMABLE_CATEGORIES.includes(category);
}

// A decoration can only have one copy of itself placed at a time — buying
// it doesn't grant unlimited placements, just the ability to place the one
// you own. Put it away (Decorate mode) to free it up for placing again.
function isPlaced(itemId) {
  return store.state.roomItems.some((i) => i.itemId === itemId);
}
// Only one pet (any of the monkey variants) can be out in the room at
// once — see findPet() in main.js, which only ever animates the first one
// anyway, so allowing more just left the rest sitting there inert.
function hasPlacedPet() {
  return store.state.roomItems.some((i) => i.kind === 'pet');
}

function cardHtml(item) {
  const { state } = store;
  const owned = state.owned.includes(item.id);
  const count = state.inventory[item.id] || 0;
  const affordable = state.money >= item.price;
  // Unlock gate for anything gated behind owning a room (see requiresRoom
  // in items.js) — checked the same way regardless of category, so a
  // locked consumable/decoration/hair/etc. shows "🔒 Locked" instead of a
  // live Buy button that would silently no-op (see buyItem()'s own check).
  const locked = item.requiresRoom && !state.owned.includes(item.requiresRoom);
  const buyOrLockBtn = locked
    ? `<button class="buy-btn" disabled>🔒 Locked</button>`
    : `<button class="buy-btn" data-buy="${item.id}" ${affordable ? '' : 'disabled'}>Buy $${item.price}</button>`;

  let footer;
  if (isConsumable(item.category)) {
    footer = `${buyOrLockBtn}
      ${count > 0 ? `<div class="item-owned">Have: ${count}</div>` : ''}`;
  } else if (item.category === 'decoration') {
    if (owned && isPlaced(item.id)) {
      footer = `<button class="use-btn" disabled>Already placed</button>`;
    } else if (owned) {
      footer = `<button class="use-btn" data-place="${item.id}">Place in room</button>`;
    } else {
      footer = buyOrLockBtn;
    }
  } else if (item.category === 'pet') {
    // Same "buy, then place" flow as a decoration, plus a hard cap of one
    // placed pet at a time (see hasPlacedPet()).
    if (owned && isPlaced(item.id)) {
      footer = `<button class="use-btn" disabled>Already placed</button>`;
    } else if (owned && hasPlacedPet()) {
      footer = `<button class="use-btn" disabled>🐒 Already have a pet out</button>`;
    } else if (owned) {
      footer = `<button class="use-btn" data-place="${item.id}">Place in room</button>`;
    } else {
      footer = buyOrLockBtn;
    }
  } else {
    // body / hair / ears / room — always exactly one equipped per category
    const equipped = state.equipped[item.category] === item.id;
    if (owned) {
      footer = `<button class="use-btn equip-btn ${equipped ? 'equipped' : ''}" data-equip="${item.id}">
        ${equipped ? 'Equipped ✓' : 'Equip'}
      </button>`;
    } else {
      footer = buyOrLockBtn;
    }
  }

  return `
    <div class="item-card">
      <div class="item-icon">${renderIcon(item.icon)}</div>
      <div class="item-name">${item.name}</div>
      <div class="item-desc">${effectDesc(item, locked)}</div>
      ${footer}
    </div>`;
}

function effectDesc(item, locked) {
  if (locked) return `Unlock by owning ${ITEMS[item.requiresRoom]?.name || 'that room'}`;
  if (item.effect) return Object.entries(item.effect).map(([k, v]) => `${v >= 0 ? '+' : ''}${v} ${k}`).join(', ');
  if (item.category === 'decoration') {
    const bonus = decorEffectDescription(item.id);
    return bonus ? `Decoration • ${bonus}` : 'Decoration';
  }
  if (item.category === 'pet') return 'Wanders the room, drops bananas, loves to play';
  if (CUSTOMIZATION_CATEGORIES.includes(item.category)) return 'Customize your pet’s look';
  if (item.category === 'room') return 'Change your room’s scenery';
  return '';
}

function renderTabContent() {
  const grid = document.getElementById('shop-grid');
  const items = itemsByCategory(activeTab);
  grid.innerHTML = items.map(cardHtml).join('');
}

function buyItem(itemId) {
  const item = ITEMS[itemId];
  const { state, persist } = store;
  if (state.money < item.price) return;
  if (item.requiresRoom && !state.owned.includes(item.requiresRoom)) return; // still locked
  state.money -= item.price;

  if (isConsumable(item.category)) {
    state.inventory[itemId] = (state.inventory[itemId] || 0) + 1;
  } else {
    state.owned.push(itemId);
  }
  persist();
  showToast(`Bought ${item.name}!`);
  renderTabContent();
  renderTrophyButton();
}

// The trophy becomes pressable once every collectible item is owned AND
// every stat is at least 75% (see allCollectiblesOwned() in items.js and
// allStatsAboveThreshold() in state.js) — re-checked every time it might
// have changed (buying the last item, or just reopening the shop later)
// rather than only once at open time, since money/stats keep moving. Once
// it's actually been clicked/viewed once, state.hasWon keeps it pressable
// forever after, even if stats later slip back below 75%.
function renderTrophyButton() {
  const btn = document.getElementById('shop-trophy');
  if (!btn) return;
  const { state } = store;
  const complete = state.hasWon || (allCollectiblesOwned(state.owned) && allStatsAboveThreshold(state.stats));
  btn.disabled = !complete;
  btn.title = complete
    ? 'You collected everything and kept every need thriving — see your reward!'
    : 'Collect everything in the shop and keep every stat at 75% or above to unlock this.';
}

function placeItem(itemId) {
  const { state, persist } = store;
  const item = ITEMS[itemId];
  // Backstop matching cardHtml()'s disabled states above — belt and
  // suspenders in case this ever gets called with a stale button.
  if (isPlaced(itemId)) { showToast('Already placed — put it away first.'); return; }
  if (item.category === 'pet' && hasPlacedPet()) { showToast('You already have a pet out — put it away first.'); return; }
  state.roomItems.push({
    uid: makeUid(itemId),
    kind: item.category === 'pet' ? 'pet' : 'decoration',
    itemId,
    x: 30 + Math.random() * 40,
    y: 55 + Math.random() * 25,
  });
  persist();
  renderRoomItems(state);
  renderTabContent();
  showToast('Placed! Use Decorate mode to move or remove it.');
}

function equipItem(itemId) {
  const item = ITEMS[itemId];
  const { state, persist } = store;
  const slot = item.category; // 'body' | 'hair' | 'ears' | 'room'
  if (state.equipped[slot] === itemId) return; // already equipped — always exactly one per slot
  state.equipped[slot] = itemId;
  persist();
  showToast(`Equipped ${item.name}!`);
  renderTabContent();
  window.dispatchEvent(new CustomEvent('outfit-changed'));
}

function onGridClick(e) {
  const buy = e.target.closest('[data-buy]');
  const place = e.target.closest('[data-place]');
  const equip = e.target.closest('[data-equip]');
  if (buy) buyItem(buy.dataset.buy);
  else if (place) placeItem(place.dataset.place);
  else if (equip) equipItem(equip.dataset.equip);
}

export function openShop(appStore) {
  store = appStore;
  activeTab = 'food';

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="shop-header-row">
      <h2>🛍️ Shop</h2>
      <button id="shop-trophy" class="trophy-btn" disabled>🏆</button>
    </div>
    <div class="tab-row" id="shop-tabs">
      ${TABS.map((t) => `<button class="tab-btn ${t.key === activeTab ? 'active' : ''}" data-tab="${t.key}">${t.label}</button>`).join('')}
    </div>
    <div class="item-grid" id="shop-grid"></div>
  `;
  openModal(wrap);
  renderTabContent();
  renderTrophyButton();

  document.getElementById('shop-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    activeTab = btn.dataset.tab;
    document.querySelectorAll('#shop-tabs .tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
    renderTabContent();
  });
  document.getElementById('shop-grid').addEventListener('click', onGridClick);
  document.getElementById('shop-trophy').addEventListener('click', () => {
    // Viewing it once is what "winning" means — permanently unlocks the
    // trophy from here on, even if stats later slip back below 75%.
    if (!store.state.hasWon) {
      store.state.hasWon = true;
      store.persist();
    }
    showWinScreen();
  });
}
