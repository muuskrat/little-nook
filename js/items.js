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
  // A pricier centerpiece food — a meaningfully bigger food refill plus a
  // real love bump, not just a snack.
  steak:        { id: 'steak', name: 'Steak', icon: '🥩', price: 45, category: 'food', effect: { food: 25, love: 4 } },
  // Unlockable food, gated the same way the beach/ice monkeys are (see
  // requiresRoom above) — only buyable once you own the matching room.
  coconut:      { id: 'coconut', name: 'Coconut', icon: '🥥', price: 16, category: 'food', effect: { food: 10, fun: 10 }, requiresRoom: 'room_island' },
  sushi:        { id: 'sushi', name: 'Sushi', icon: '🍣', price: 28, category: 'food', effect: { food: 15, love: 3, fun: 10 }, requiresRoom: 'room_snow' },

  water_bottle: { id: 'water_bottle', name: 'Water', icon: '💧', price: 4, category: 'water', effect: { water: 20 } },
  juice:        { id: 'juice', name: 'Juice', icon: '🧃', price: 8, category: 'water', effect: { water: 25, fun: 5 } },
  // A negative component costs that stat instead of restoring it (coffee's
  // dehydration, wine's) — applied as an instant cost the moment it's
  // picked up rather than sipped gradually, see goDrink() in js/main.js.
  coffee:       { id: 'coffee', name: 'Coffee', icon: '☕', price: 10, category: 'water', effect: { water: -5, sleep: 20 } },
  water_gallon: { id: 'water_gallon', name: 'Gallon of Water', icon: '🚰', price: 14, category: 'water', effect: { water: 40 } },
  wine:         { id: 'wine', name: 'Wine', icon: '🍷', price: 25, category: 'water', effect: { water: -5, love: 8 }, requiresRoom: 'room_island' },
  hokkaido_milk: { id: 'hokkaido_milk', name: 'Hokkaido Milk', icon: '🥛', price: 20, category: 'water', effect: { water: 15, health: 10, food: 5 }, requiresRoom: 'room_snow' },

  vitamin:      { id: 'vitamin', name: 'Vitamin', icon: '💊', price: 10, category: 'medicine', effect: { health: 15 } },
  potion:       { id: 'potion', name: 'Potion', icon: '🧪', price: 20, category: 'medicine', effect: { health: 35 } },

  // Decorations placed in the room can carry a passive bonus (see
  // DECOR_EFFECTS below) on top of just being cosmetic. Icons are real
  // image assets under assets/icons/decor/, not emoji.
  plant:        { id: 'plant', name: 'Plant', icon: 'assets/icons/decor/plant.png', price: 20, category: 'decoration' },
  lamp:         { id: 'lamp', name: 'Lamp', icon: 'assets/icons/decor/lamp.png', price: 22, category: 'decoration' },
  // Renamed from "Painting" — same id/icon, just a different in-fiction
  // object (a fun-decay bonus reads more naturally coming from art
  // supplies to tinker with than a painting on the wall).
  painting:     { id: 'painting', name: 'Art Supplies', icon: 'assets/icons/decor/painting.png', price: 28, category: 'decoration' },
  candle:       { id: 'candle', name: 'Candle', icon: 'assets/icons/decor/candle.png', price: 12, category: 'decoration' },
  chair:        { id: 'chair', name: 'Chair', icon: 'assets/icons/decor/chair.png', price: 24, category: 'decoration' },
  window:       { id: 'window', name: 'Window', icon: 'assets/icons/decor/window.png', price: 30, category: 'decoration' },
  // Renamed from "Bed" — same id/icon.
  bed:          { id: 'bed', name: 'Tatami', icon: 'assets/icons/decor/bed.png', price: 40, category: 'decoration' },
  // Not just cosmetic — the pet actually walks over to eat at a placed
  // table instead of eating wherever the food happens to be sitting (see
  // ACTIVITY_DECOR in js/main.js). No passive bonus, same as plant/lamp/
  // painting/chair.
  table:        { id: 'table', name: 'Table', icon: 'assets/icons/decor/table.png', price: 26, category: 'decoration' },
  // Unlockable decorations with a passive DECOR_EFFECTS bonus (see below) —
  // gated the same way monkey_beach/monkey_ice are, just for the
  // 'decoration' category instead of 'pet'. Reuses the Sneaky Sniff
  // mini-game's shoe art (assets/icons/minigames/) rather than a duplicate
  // asset — same object, just sitting in the room instead of being sniffed.
  stink_shoe:   { id: 'stink_shoe', name: 'Stink Shoe', icon: 'assets/icons/minigames/stinky-shoe.png', price: 35, category: 'decoration', requiresRoom: 'room_island' },
  cute_photo:   { id: 'cute_photo', name: 'Cute Photo', icon: 'assets/icons/decor/cute-photo.png', price: 25, category: 'decoration', requiresRoom: 'room_island' },
  miku_plushie: { id: 'miku_plushie', name: 'Miku Plushie', icon: 'assets/icons/decor/miku-plushie.png', price: 38, category: 'decoration', requiresRoom: 'room_snow' },
  // Gate an entire interaction behind actually owning + placing the
  // matching gear, rather than a passive stat bonus — see DECOR_UNLOCKS
  // below and toggleInteraction() in js/main.js.
  weights:      { id: 'weights', name: 'Weights', icon: 'assets/icons/decor/weights.png', price: 32, category: 'decoration' },
  toys:         { id: 'toys', name: 'Toys', icon: 'assets/icons/decor/toys.png', price: 28, category: 'decoration' },
  water_bowl:   { id: 'water_bowl', name: 'Water Bowl', icon: 'assets/icons/decor/water-bowl.png', price: 18, category: 'decoration' },
  kibble:       { id: 'kibble', name: 'Kibble', icon: 'assets/icons/decor/kibble.png', price: 18, category: 'decoration' },

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
  hair_miku:    { id: 'hair_miku', name: 'Miku Hair', icon: '🎤', price: 35, category: 'hair', requiresRoom: 'room_snow' },
  'hair_bald':      { id: 'hair_bald', name: 'Bald', icon: '👨‍🦲', price: 25, category: 'hair' },
  'hair_pony-tail': { id: 'hair_pony-tail', name: 'Pony Tail', icon: '🎀', price: 25, category: 'hair' },
  // Unlockable, same requiresRoom gate as monkey_beach/hair_miku.
  'hair_braided':   { id: 'hair_braided', name: 'Braided Hair', icon: '🪢', price: 30, category: 'hair', requiresRoom: 'room_island' },

  ears_bunny:   { id: 'ears_bunny', name: 'Bunny Ears', icon: '🐰', price: 0, category: 'ears' },
  ears_cat:     { id: 'ears_cat', name: 'Cat Ears', icon: '🐱', price: 20, category: 'ears' },
  ears_round:   { id: 'ears_round', name: 'Round Ears', icon: '🐻', price: 20, category: 'ears' },
  ears_floppy:  { id: 'ears_floppy', name: 'Floppy Ears', icon: '🐶', price: 20, category: 'ears' },
  ears_sideways: { id: 'ears_sideways', name: 'Sideways Ears', icon: '🦇', price: 20, category: 'ears' },
  'ears_small-round': { id: 'ears_small-round', name: 'Small Round Ears', icon: '🐭', price: 20, category: 'ears' },

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

// True once every permanent, ownable item in the catalog has been bought —
// decorations, pets, body/hair/ears options, and rooms, but not food/water/
// medicine (those are used up, not "collected," so they don't count toward
// completion). See the trophy button in js/shop.js.
export function allCollectiblesOwned(owned) {
  return Object.values(ITEMS)
    .filter((i) => !CONSUMABLE_CATEGORIES.includes(i.category))
    .every((i) => owned.includes(i.id));
}
// The "always exactly one active" categories — see CUSTOMIZATION_CATEGORIES's
// use in js/shop.js for the shop-card wording, and state.equipped in
// state.js for the actual one-per-slot bookkeeping.
export const CUSTOMIZATION_CATEGORIES = ['body', 'hair', 'ears'];
// The item that starts owned+equipped in each "always exactly one active"
// category (character customization plus which room is current).
export const DEFAULT_CUSTOMIZATION = { body: 'body_regular', hair: 'hair_long', ears: 'ears_bunny', room: 'room_normal' };

// Passive bonuses from decorations placed in the room — presence-based
// (owning two of the same decoration is impossible anyway, see isPlaced()
// in js/shop.js), but two *different* decorations sharing the same bonus
// key (e.g. Candle and Cute Photo both boosting loveGainMult) do stack,
// multiplicatively — see activeDecorEffects() below.
export const DECOR_EFFECTS = {
  bed: { sleepGainMult: 1.6 },       // regenerates sleep faster
  // interactGainMult boosts the stat gains from directly using Pet/Play/
  // Exercise (see the doXInteraction()/pettingLoop() functions in
  // js/main.js) — not passive decay, and not Scold.
  window: { interactGainMult: 1.15 },
  candle: { loveGainMult: 1.15 },    // +15% whenever love increases
  plant: { funGainMult: 1.10 },      // +10% whenever fun increases
  painting: { funDecayMult: 0.9 },   // fun decays a little slower
  chair: { sleepDecayMult: 0.85 },   // sleep drains slower while awake
  // Halves the base chance of a random trip — see tripChance() in
  // js/main.js, which multiplies this in alongside the existing
  // mess-count scaling rather than replacing it.
  lamp: { tripChanceMult: 0.5 },
  water_bowl: { waterDecayMult: 0.8 },
  kibble: { foodDecayMult: 0.8 },
  // See gainFun()/applyEffectPart() in js/main.js for what "fun gain"
  // and "love gain" route through, and healthDrainMult's use in
  // applyDecay()/meterRatePerMin() in js/state.js.
  stink_shoe: { funGainMult: 1.15, loveGainMult: 1.05, healthDrainMult: 0.85 },
  cute_photo: { loveGainMult: 1.15 },
  // playEnergyRegenMult only speeds up the Play interaction's own energy
  // meter (see applyDecay() in js/state.js) — Pet's and Exercise's meters
  // are untouched.
  miku_plushie: { funGainMult: 1.10, playEnergyRegenMult: 1.5 },
};

// Some decorations don't grant a passive stat bonus at all — instead,
// having them placed in the room is what unlocks an entire interaction
// (see toggleInteraction() in js/main.js, which reads this the same way
// activeDecorEffects() reads DECOR_EFFECTS). Kept separate from
// DECOR_EFFECTS since "gates an interaction" isn't a multiplier and
// doesn't belong in activeDecorEffects()'s merge.
export const DECOR_UNLOCKS = {
  weights: 'exercise',
  toys: 'play',
};

// Merges the effects of every DECOR_EFFECTS decoration currently placed in
// the room (state.roomItems) into one effect object — multiplying together
// when more than one placed decoration shares the same bonus key, rather
// than the last one silently winning.
export function activeDecorEffects(roomItems) {
  const placedIds = new Set((roomItems || []).filter((i) => i.kind === 'decoration').map((i) => i.itemId));
  const merged = {};
  for (const [itemId, effect] of Object.entries(DECOR_EFFECTS)) {
    if (!placedIds.has(itemId)) continue;
    for (const [key, val] of Object.entries(effect)) {
      merged[key] = (merged[key] ?? 1) * val;
    }
  }
  return merged;
}

// One human-readable line per DECOR_EFFECTS key — shared by
// decorEffectDescription() below (every bonus a single decoration grants)
// and free to grow as new bonus keys get added.
const DECOR_EFFECT_LABELS = {
  sleepGainMult: (v) => `Sleep regenerates ${Math.round((v - 1) * 100)}% faster`,
  sleepDecayMult: (v) => `Sleep drains ${Math.round((1 - v) * 100)}% slower`,
  funDecayMult: (v) => `Fun decays ${Math.round((1 - v) * 100)}% slower`,
  loveGainMult: (v) => `+${Math.round((v - 1) * 100)}% whenever love increases`,
  funGainMult: (v) => `+${Math.round((v - 1) * 100)}% whenever fun increases`,
  healthDrainMult: (v) => `Health drains ${Math.round((1 - v) * 100)}% slower`,
  playEnergyRegenMult: (v) => `Play energy regenerates ${Math.round((v - 1) * 100)}% faster`,
  interactGainMult: (v) => `+${Math.round((v - 1) * 100)}% from Pet/Play/Exercise`,
  waterDecayMult: (v) => `Water drains ${Math.round((1 - v) * 100)}% slower`,
  foodDecayMult: (v) => `Food drains ${Math.round((1 - v) * 100)}% slower`,
  tripChanceMult: (v) => `${Math.round((1 - v) * 100)}% less likely to trip`,
};

// Human names for INTERACTIONS keys (see js/main.js) — only used by
// decorEffectDescription() below to describe a DECOR_UNLOCKS entry.
const INTERACTION_NAMES = { pet: 'Pet', play: 'Play', exercise: 'Exercise', scold: 'Scold' };

// Human-readable "what does this do" text for a decoration — used both as
// the shop card description and as the hover tooltip on a placed decoration
// in the room (see renderRoomItems() in js/room.js). A decoration can grant
// more than one bonus (e.g. Stink Shoe), so this joins every line it has.
export function decorEffectDescription(itemId) {
  const unlocks = DECOR_UNLOCKS[itemId];
  if (unlocks) return `Unlocks the ${INTERACTION_NAMES[unlocks] || unlocks} interaction`;
  const bonus = DECOR_EFFECTS[itemId];
  if (!bonus) return null;
  const lines = Object.entries(bonus).map(([key, val]) => DECOR_EFFECT_LABELS[key]?.(val)).filter(Boolean);
  return lines.length ? lines.join(', ') : null;
}
