// Shop catalog. `icon` is an emoji placeholder — swap for your own hand-drawn
// icon by changing it to an <img> path once you build the real asset pipeline
// (see ui.js renderIcon()).

export const ITEMS = {
  apple:        { id: 'apple', name: 'Apple', icon: '🍎', price: 5, category: 'food', effect: { food: 15 } },
  sandwich:     { id: 'sandwich', name: 'Sandwich', icon: '🥪', price: 12, category: 'food', effect: { food: 30 } },
  // irresistible: the pet will go for this almost regardless of how full it
  // already is (see foodDesire() in main.js) — can push it into the
  // "stuffed" emotion if eaten while already nearly full.
  cake:         { id: 'cake', name: 'Cake', icon: '🍰', price: 18, category: 'food', effect: { food: 20, fun: 10 }, irresistible: true },
  // Also dropped for free by a placed Monkey decoration (see monkeyTick()
  // in js/main.js) — buyable too, same as any other food. messOnEat: eating
  // one always leaves a peel behind, unlike the ~15% chance other food has
  // to leave crumbs — see eatAt() in js/main.js.
  banana:       { id: 'banana', name: 'Banana', icon: '🍌', price: 6, category: 'food', effect: { food: 4 }, messOnEat: 'peel' },

  water_bottle: { id: 'water_bottle', name: 'Water', icon: '💧', price: 4, category: 'water', effect: { water: 20 } },
  juice:        { id: 'juice', name: 'Juice', icon: '🧃', price: 8, category: 'water', effect: { water: 25, fun: 5 } },

  vitamin:      { id: 'vitamin', name: 'Vitamin', icon: '💊', price: 10, category: 'medicine', effect: { health: 15 } },
  potion:       { id: 'potion', name: 'Potion', icon: '🧪', price: 20, category: 'medicine', effect: { health: 35 } },

  // Decorations placed in the room can carry a passive bonus (see
  // DECOR_EFFECTS below) on top of just being cosmetic. Icons are real
  // image assets under assets/icons/decor/, not emoji.
  plant:        { id: 'plant', name: 'Plant', icon: 'assets/icons/decor/plant.png', price: 20, category: 'decoration' },
  lamp:         { id: 'lamp', name: 'Lamp', icon: 'assets/icons/decor/lamp.png', price: 22, category: 'decoration' },
  painting:     { id: 'painting', name: 'Painting', icon: 'assets/icons/decor/painting.png', price: 28, category: 'decoration' },
  candle:       { id: 'candle', name: 'Candle', icon: 'assets/icons/decor/candle.png', price: 12, category: 'decoration' },
  chair:        { id: 'chair', name: 'Chair', icon: 'assets/icons/decor/chair.png', price: 24, category: 'decoration' },
  window:       { id: 'window', name: 'Window', icon: 'assets/icons/decor/window.png', price: 30, category: 'decoration' },
  bed:          { id: 'bed', name: 'Bed', icon: 'assets/icons/decor/bed.png', price: 40, category: 'decoration' },
  // Not just cosmetic — the pet actually walks over to eat at a placed
  // table instead of eating wherever the food happens to be sitting (see
  // ACTIVITY_DECOR in js/main.js). No passive bonus, same as plant/lamp/
  // painting/chair.
  table:        { id: 'table', name: 'Table', icon: 'assets/icons/decor/table.png', price: 26, category: 'decoration' },

  // Pets: placed in the room like a decoration (same "buy, then place"
  // flow, same roomItems system — see placeItem() in js/shop.js), but kept
  // in their own category instead of 'decoration' specifically so all of
  // that generic decoration logic (DECOR_EFFECTS, findPlayTarget()'s
  // weighting, resizing) doesn't need itemId special-cases to exclude or
  // handle them. Unlike every decoration, a placed pet wanders the room on
  // its own and occasionally drops a free banana (see monkeyTick() in
  // js/main.js), and it's the pet's favorite thing to play with (see
  // MONKEY_PLAY_WEIGHT there too).
  monkey:       { id: 'monkey', name: 'Monkey', icon: 'assets/icons/decor/monkey.png', price: 60, category: 'pet' },
  // Unlockable variants — only buyable once you own the matching room (see
  // requiresRoom, checked in js/shop.js).
  monkey_beach: { id: 'monkey_beach', name: 'Beach Monkey', icon: 'assets/icons/decor/monkey-beach.png', price: 70, category: 'pet', requiresRoom: 'room_island' },
  monkey_ice:   { id: 'monkey_ice', name: 'Ice Monkey', icon: 'assets/icons/decor/monkey-ice.png', price: 70, category: 'pet', requiresRoom: 'room_snow' },

  // Character customization: body/hair/ears, each with a free starter (the
  // pet's original look) plus two purchasable alternatives. Exactly one of
  // each is always equipped — see state.equipped in state.js. "Body" here
  // means outfit, not body shape — every option is the same proportions,
  // just different clothes (see assets/character/parts/body/<type>/).
  body_regular: { id: 'body_regular', name: 'Regular', icon: '👕', price: 0, category: 'body' },
  body_bikini:  { id: 'body_bikini', name: 'Bikini', icon: '👙', price: 35, category: 'body' },
  body_snow:    { id: 'body_snow', name: 'Snow Outfit', icon: '🧥', price: 35, category: 'body' },

  hair_long:    { id: 'hair_long', name: 'Long Hair', icon: '💇', price: 0, category: 'hair' },
  hair_short:   { id: 'hair_short', name: 'Short Hair', icon: '💇‍♀️', price: 25, category: 'hair' },
  hair_curly:   { id: 'hair_curly', name: 'Curly Hair', icon: '🌀', price: 25, category: 'hair' },

  ears_bunny:   { id: 'ears_bunny', name: 'Bunny Ears', icon: '🐰', price: 0, category: 'ears' },
  ears_cat:     { id: 'ears_cat', name: 'Cat Ears', icon: '🐱', price: 20, category: 'ears' },
  ears_round:   { id: 'ears_round', name: 'Round Ears', icon: '🐻', price: 20, category: 'ears' },

  // Rooms: pick which scenery the room is dressed in. Exactly one equipped
  // at a time, same "buy once, equip any owned one" mechanism as body/hair/
  // ears — see setRoomTheme() in js/room.js.
  room_normal:  { id: 'room_normal', name: 'Cozy Room', icon: '🏠', price: 0, category: 'room' },
  room_island:  { id: 'room_island', name: 'Island', icon: '🏝️', price: 100, category: 'room' },
  room_snow:    { id: 'room_snow', name: 'Snowy Japan', icon: '⛩️', price: 100, category: 'room' },
};

export function itemsByCategory(category) {
  return Object.values(ITEMS).filter((i) => i.category === category);
}

// Which categories a purchase adds to inventory (stackable, used up) vs.
// state.owned (one-time, permanent) — see isConsumable() in js/shop.js.
export const CONSUMABLE_CATEGORIES = ['food', 'water', 'medicine'];
// The "always exactly one active" categories — see CUSTOMIZATION_CATEGORIES's
// use in js/shop.js for the shop-card wording, and state.equipped in
// state.js for the actual one-per-slot bookkeeping.
export const CUSTOMIZATION_CATEGORIES = ['body', 'hair', 'ears'];
// The item that starts owned+equipped in each "always exactly one active"
// category (character customization plus which room is current).
export const DEFAULT_CUSTOMIZATION = { body: 'body_regular', hair: 'hair_long', ears: 'ears_bunny', room: 'room_normal' };

// Passive bonuses from decorations placed in the room (presence-based, not
// stacking with duplicates — see activeDecorEffects()).
export const DECOR_EFFECTS = {
  bed: { sleepGainMult: 1.6 },       // regenerates sleep faster
  window: { funDecayMult: 0.7 },     // fun decays slower
  candle: { loveGainMult: 1.15 },    // +15% whenever love increases
};

// Merges the effects of every DECOR_EFFECTS decoration currently placed in
// the room (state.roomItems) into one effect object.
export function activeDecorEffects(roomItems) {
  const placedIds = new Set((roomItems || []).filter((i) => i.kind === 'decoration').map((i) => i.itemId));
  const merged = {};
  for (const [itemId, effect] of Object.entries(DECOR_EFFECTS)) {
    if (placedIds.has(itemId)) Object.assign(merged, effect);
  }
  return merged;
}

// Human-readable "what does this do" text for a decoration — used both as
// the shop card description and as the hover tooltip on a placed decoration
// in the room (see renderRoomItems() in js/room.js).
export function decorEffectDescription(itemId) {
  const bonus = DECOR_EFFECTS[itemId];
  if (!bonus) return null;
  if (bonus.sleepGainMult) return `Sleep regenerates ${Math.round((bonus.sleepGainMult - 1) * 100)}% faster`;
  if (bonus.funDecayMult) return `Fun decays ${Math.round((1 - bonus.funDecayMult) * 100)}% slower`;
  if (bonus.loveGainMult) return `+${Math.round((bonus.loveGainMult - 1) * 100)}% whenever love increases`;
  return null;
}
