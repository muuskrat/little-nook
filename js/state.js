// Game state: shape, persistence (localStorage), and time-based stat decay.

import { computeEmotion, emotionEffect } from './emotions.js';
import { ITEMS, DEFAULT_CUSTOMIZATION, DECOR_EFFECTS, activeDecorEffects } from './items.js';

export const STAT_KEYS = ['food', 'water', 'sleep', 'fun', 'health', 'love'];
const STORAGE_KEY = 'littleNookSave.v2';
const OLD_STORAGE_KEY = 'littleNookSave.v1';

export function makeUid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function defaultState() {
  return {
    version: 2,
    petName: 'Pet',
    createdAt: Date.now(),
    lastUpdate: Date.now(),
    isSleeping: false,
    sleepTarget: 100, // wake once sleep reaches this value — see goToSleep() in main.js for how it's randomized
    walk: { x: 50, y: 55 }, // last known position, % of floor
    stats: { food: 80, water: 80, sleep: 80, fun: 80, health: 100, love: 70 },
    // Energy for the Pet/Play/Exercise interactions (see main.js's
    // INTERACT_ENERGY_COST) — separate from the stats themselves: these are
    // what limit how often you can directly interact with the pet, and they
    // all refill on their own at the same rate (see
    // INTERACT_ENERGY_REGEN_PER_MIN below).
    playEnergy: 100,
    petEnergy: 100,
    exerciseEnergy: 100,
    // When the Pet interaction was last actually used (see startPetting()
    // in js/main.js) — drives how much faster love drains the longer it's
    // been, see PET_NEGLECT_RAMP_MIN/petNeglectMult() below. Starts at
    // "just now" so a brand-new save doesn't open already at the max
    // neglect penalty.
    lastPetAt: Date.now(),
    money: 30,
    minigameCooldowns: {}, // gameKey -> timestamp (ms) when it's playable again, see js/minigames/index.js
    inventory: {},              // consumable itemId -> count owned (unplaced, in "backpack")
    owned: Object.values(DEFAULT_CUSTOMIZATION), // decoration/customization itemIds purchased (one-time) — starts with the free customization options
    equipped: { ...DEFAULT_CUSTOMIZATION },      // { body, hair, ears } — always exactly one of each
    // Everything placed in the room lives here, one flat list:
    //   decoration -> { uid, kind:'decoration', itemId, x, y }
    //   food/water -> { uid, kind:'food'|'water', itemId, x, y, effect }
    //   mess       -> { uid, kind:'mess', subtype:'spill', x, y, createdAt }
    roomItems: [],
  };
}

export function clamp(v, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

export function loadState() {
  const base = defaultState();
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    let migratingOld = false;
    if (!raw) {
      raw = localStorage.getItem(OLD_STORAGE_KEY);
      migratingOld = !!raw;
    }
    if (!raw) return base;
    const parsed = JSON.parse(raw);

    const roomItems = Array.isArray(parsed.roomItems)
      ? parsed.roomItems
      : (parsed.placedDecorations || []).map((d) => ({ ...d, kind: 'decoration' }));
    // The monkey used to be placed with kind:'decoration' before it became
    // its own 'pet' category (see items.js) — fix up anything placed under
    // the old kind so an existing save doesn't lose its pet's size/movement.
    // Driven by the current catalog rather than an itemId list, so it keeps
    // working for any future pet item too.
    for (const item of roomItems) {
      if (item.kind === 'decoration' && ITEMS[item.itemId]?.category === 'pet') item.kind = 'pet';
    }

    const equipped = { ...base.equipped, ...(parsed.equipped || {}) };
    // Guard against a saved equip pointing at an item that no longer exists
    // in the catalog (e.g. after a rename/removal) — fall back to that
    // slot's default rather than rendering a broken image.
    for (const key of Object.keys(DEFAULT_CUSTOMIZATION)) {
      if (!ITEMS[equipped[key]]) equipped[key] = DEFAULT_CUSTOMIZATION[key];
    }

    const merged = {
      ...base,
      ...parsed,
      stats: { ...base.stats, ...(parsed.stats || {}) },
      equipped,
      walk: { ...base.walk, ...(parsed.walk || {}) },
      roomItems,
    };
    delete merged.placedDecorations;
    if (migratingOld) localStorage.removeItem(OLD_STORAGE_KEY);
    return merged;
  } catch (e) {
    console.warn('Save data corrupted, starting fresh.', e);
    return base;
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(OLD_STORAGE_KEY);
  return defaultState();
}

// All passive drain rates below are 5x their original tuning (a first
// pass at making neglect actually bite — easy to dial back down, or back
// up further, from here if it turns out too harsh/too light in practice).
// Gains (SLEEP_GAIN_PER_MIN, health's passive recovery, INTERACT_ENERGY_
// REGEN_PER_MIN, every player-action reward) are deliberately untouched —
// this pass is about drains specifically.
const DECAY_PER_MIN = { food: 2.25, water: 2.75, sleep: 1.75, fun: 2.0, love: 0.6 };
const SLEEP_GAIN_PER_MIN = 4.5;
// How fast the Pet/Play/Exercise interactions' energy meters refill on
// their own — see INTERACT_ENERGY_COST in main.js for how much a single
// use of any of them costs.
const INTERACT_ENERGY_REGEN_PER_MIN = 40;
const MAX_CATCHUP_MIN = 60 * 24; // don't punish players for being away more than a day
const MESS_FUN_PENALTY_PER_MIN = 0.75;
const MESS_LOVE_PENALTY_PER_MIN = 0.4;
// Health takes a much bigger hit per mess than fun/love do — living in a
// dirty room is a health hazard, not just an annoyance.
const MESS_HEALTH_PENALTY_PER_MIN = 2.5;
// Health's own penalty for each need (food/water/sleep/fun) currently
// critically low — shared between applyDecay() and meterRatePerMin() below
// so the two can never drift apart on what this actually costs.
const HEALTH_LOW_NEED_PENALTY_PER_MIN = 1.1;
// The longer it's been since the player last used the Pet interaction, the
// faster love drains — ramping up linearly and capping out at
// PET_NEGLECT_MAX_MULT once PET_NEGLECT_RAMP_MIN minutes have passed, so
// neglect gets steadily worse rather than jumping straight to its worst
// penalty, but doesn't keep climbing forever either.
const PET_NEGLECT_RAMP_MIN = 5;
const PET_NEGLECT_MAX_MULT = 4;

// 1 right after petting, ramping up to PET_NEGLECT_MAX_MULT by
// PET_NEGLECT_RAMP_MIN minutes of neglect and staying there — see
// applyDecay() (drives the actual extra drain) and
// meterEffectDescriptions() (drives the love meter's tooltip) below.
export function petNeglectMult(state, now = Date.now()) {
  const minutesSincePet = (now - (state.lastPetAt ?? now)) / 60000;
  const fraction = Math.min(1, Math.max(0, minutesSincePet / PET_NEGLECT_RAMP_MIN));
  return 1 + fraction * (PET_NEGLECT_MAX_MULT - 1);
}

// Advances stats based on real time elapsed since state.lastUpdate.
// Called on load (catch-up) and on a periodic tick while the app is open.
export function applyDecay(state, now = Date.now()) {
  let minutes = (now - state.lastUpdate) / 60000;
  if (minutes <= 0) {
    state.lastUpdate = now;
    return state;
  }
  minutes = Math.min(minutes, MAX_CATCHUP_MIN);

  const s = state.stats;
  const messCount = (state.roomItems || []).filter((i) => i.kind === 'mess').length;
  // Whichever stat is furthest out of its healthy band (too low OR too
  // high) applies its own extra multiplier on top of the base decay —
  // e.g. an overfed pet (food too high) gets tired faster and a starving
  // one (food too low) loses fun/love faster. See emotions.js.
  const effect = emotionEffect(computeEmotion(state, { messCount }));
  // Placed decorations can also passively help — a bed regenerates sleep
  // faster, a window slows fun decay. See items.js's DECOR_EFFECTS.
  const decor = activeDecorEffects(state.roomItems);

  if (state.isSleeping) {
    s.sleep = clamp(s.sleep + SLEEP_GAIN_PER_MIN * (decor.sleepGainMult || 1) * minutes);
    s.food = clamp(s.food - DECAY_PER_MIN.food * 0.3 * minutes);
    s.water = clamp(s.water - DECAY_PER_MIN.water * 0.3 * minutes);
    // Naps are random-length (see goToSleep() in main.js) rather than
    // always running until fully rested.
    if (s.sleep >= (state.sleepTarget ?? 100)) state.isSleeping = false;
  } else {
    s.food = clamp(s.food - DECAY_PER_MIN.food * minutes);
    s.water = clamp(s.water - DECAY_PER_MIN.water * minutes);
    s.sleep = clamp(s.sleep - DECAY_PER_MIN.sleep * (effect.sleepMult || 1) * minutes);
    s.fun = clamp(s.fun - DECAY_PER_MIN.fun * (effect.funMult || 1) * (decor.funDecayMult || 1) * minutes);
  }
  s.love = clamp(s.love - DECAY_PER_MIN.love * (effect.loveMult || 1) * petNeglectMult(state, now) * minutes);

  // Each mess scales its own penalties by how many are sitting around at
  // once — one mess is a minor drag, a room full of them is a real problem.
  // Health falls much faster per mess than fun/love do (see
  // MESS_HEALTH_PENALTY_PER_MIN above) — a messy room is a health hazard,
  // not just unpleasant.
  // A placed Stink Shoe cuts every health drain below by its
  // healthDrainMult (see DECOR_EFFECTS in items.js) — applied alongside
  // the mood's own healthPenaltyMult rather than replacing it.
  const healthDrainMult = decor.healthDrainMult || 1;
  if (messCount > 0) {
    s.fun = clamp(s.fun - MESS_FUN_PENALTY_PER_MIN * messCount * minutes);
    s.love = clamp(s.love - MESS_LOVE_PENALTY_PER_MIN * messCount * minutes);
    s.health = clamp(s.health - MESS_HEALTH_PENALTY_PER_MIN * messCount * (effect.healthPenaltyMult || 1) * healthDrainMult * minutes);
  }

  const needKeys = ['food', 'water', 'sleep', 'fun'];
  const lowCount = needKeys.filter((k) => s[k] < 25).length;
  const allGreat = needKeys.every((k) => s[k] >= 60);
  if (lowCount > 0) {
    s.health = clamp(s.health - lowCount * HEALTH_LOW_NEED_PENALTY_PER_MIN * (effect.healthPenaltyMult || 1) * healthDrainMult * minutes);
  } else if (allGreat && messCount === 0) {
    // a spotless room with a well-cared-for pet slowly recovers health —
    // but not while there's still mess dragging it down (see above)
    s.health = clamp(s.health + 0.18 * minutes);
  }

  // A placed Miku Plushie only speeds up Play's own energy meter (see
  // DECOR_EFFECTS in items.js) — Pet's and Exercise's are unaffected.
  state.playEnergy = clamp((state.playEnergy ?? 100) + INTERACT_ENERGY_REGEN_PER_MIN * (decor.playEnergyRegenMult || 1) * minutes);
  state.petEnergy = clamp((state.petEnergy ?? 100) + INTERACT_ENERGY_REGEN_PER_MIN * minutes);
  state.exerciseEnergy = clamp((state.exerciseEnergy ?? 100) + INTERACT_ENERGY_REGEN_PER_MIN * minutes);

  state.lastUpdate = now;
  return state;
}

// The current net rate (per minute, signed — negative drains, positive
// regenerates) for one stat right now — mirrors applyDecay()'s own
// branching exactly (same emotion/decor/mess/neglect multipliers, same
// per-stat special cases like food/water decaying slower while asleep or
// fun not decaying from time alone while asleep) so the number shown in
// the meter's tooltip (see renderMeters() in js/ui.js) can never disagree
// with what the stat is actually about to do on the next real tick.
export function meterRatePerMin(state, statKey) {
  const s = state.stats;
  const messCount = (state.roomItems || []).filter((i) => i.kind === 'mess').length;
  const effect = emotionEffect(computeEmotion(state, { messCount }));
  const decor = activeDecorEffects(state.roomItems);

  if (statKey === 'food') return -DECAY_PER_MIN.food * (state.isSleeping ? 0.3 : 1);
  if (statKey === 'water') return -DECAY_PER_MIN.water * (state.isSleeping ? 0.3 : 1);
  if (statKey === 'sleep') {
    return state.isSleeping
      ? SLEEP_GAIN_PER_MIN * (decor.sleepGainMult || 1)
      : -DECAY_PER_MIN.sleep * (effect.sleepMult || 1);
  }
  if (statKey === 'fun') {
    let rate = state.isSleeping ? 0 : -DECAY_PER_MIN.fun * (effect.funMult || 1) * (decor.funDecayMult || 1);
    if (messCount > 0) rate -= MESS_FUN_PENALTY_PER_MIN * messCount;
    return rate;
  }
  if (statKey === 'love') {
    let rate = -DECAY_PER_MIN.love * (effect.loveMult || 1) * petNeglectMult(state);
    if (messCount > 0) rate -= MESS_LOVE_PENALTY_PER_MIN * messCount;
    return rate;
  }
  if (statKey === 'health') {
    let rate = 0;
    const healthDrainMult = decor.healthDrainMult || 1;
    if (messCount > 0) rate -= MESS_HEALTH_PENALTY_PER_MIN * messCount * (effect.healthPenaltyMult || 1) * healthDrainMult;
    const needKeys = ['food', 'water', 'sleep', 'fun'];
    const lowCount = needKeys.filter((k) => s[k] < 25).length;
    const allGreat = needKeys.every((k) => s[k] >= 60);
    if (lowCount > 0) rate -= lowCount * HEALTH_LOW_NEED_PENALTY_PER_MIN * (effect.healthPenaltyMult || 1) * healthDrainMult;
    else if (allGreat && messCount === 0) rate += 0.18;
    return rate;
  }
  return 0;
}

// Renders one multiplier as "X% faster/slower" (or a custom up/down word
// pair, e.g. "boosted/reduced") based on which side of 1 it falls on —
// shared by every line below so the wording always matches the actual sign
// of the multiplier instead of being hardcoded per call site.
function multDesc(mult, upWord = 'faster', downWord = 'slower') {
  const pct = Math.round(Math.abs(mult - 1) * 100);
  return `${pct}% ${mult > 1 ? upWord : downWord}`;
}

// Finds the name of a placed decoration responsible for a given
// DECOR_EFFECTS key (e.g. 'sleepGainMult') — decor bonuses are presence-only
// or activeDecorEffects() but with no way to say "here's why", so match it
// back to the item the same way the effect is currently satisfied.
function decorLabelFor(roomItems, effectKey) {
  const placedIds = new Set((roomItems || []).filter((i) => i.kind === 'decoration').map((i) => i.itemId));
  const names = [];
  for (const [itemId, effect] of Object.entries(DECOR_EFFECTS)) {
    if (placedIds.has(itemId) && effect[effectKey] != null) names.push(ITEMS[itemId]?.name || itemId);
  }
  return names.length ? names.join(' + ') : null;
}

// Human-readable list of whatever's currently changing one meter's rate —
// the pet's mood, a placed decoration, or a messy room — used for the
// meter's hover tooltip (see renderMeters() in js/ui.js). Deliberately
// mirrors applyDecay()'s own branching above so the tooltip can never claim
// something isn't actually happening to the numbers.
export function meterEffectDescriptions(state, statKey) {
  const s = state.stats;
  const messCount = (state.roomItems || []).filter((i) => i.kind === 'mess').length;
  const emotionKey = computeEmotion(state, { messCount });
  const effect = emotionEffect(emotionKey);
  const decor = activeDecorEffects(state.roomItems);
  const moodLabel = emotionKey === 'happy' ? null : emotionKey[0].toUpperCase() + emotionKey.slice(1);
  const messLabel = messCount > 0 ? `${messCount} mess${messCount > 1 ? 'es' : ''}` : null;
  const lines = [];

  if (statKey === 'sleep') {
    if (state.isSleeping) {
      const label = decorLabelFor(state.roomItems, 'sleepGainMult');
      if (label && decor.sleepGainMult && decor.sleepGainMult !== 1) {
        lines.push(`${label}: sleep regenerates ${multDesc(decor.sleepGainMult)}`);
      }
    } else if (moodLabel && effect.sleepMult && effect.sleepMult !== 1) {
      lines.push(`${moodLabel}: sleep drains ${multDesc(effect.sleepMult)}`);
    }
  } else if (statKey === 'fun') {
    if (moodLabel && effect.funMult && effect.funMult !== 1) {
      lines.push(`${moodLabel}: fun drains ${multDesc(effect.funMult)}`);
    }
    const label = decorLabelFor(state.roomItems, 'funDecayMult');
    if (label && decor.funDecayMult && decor.funDecayMult !== 1) {
      lines.push(`${label}: fun drains ${multDesc(decor.funDecayMult)}`);
    }
    if (messLabel) lines.push(`${messLabel}: extra fun drain`);
  } else if (statKey === 'love') {
    if (moodLabel && effect.loveMult && effect.loveMult !== 1) {
      lines.push(`${moodLabel}: love drains ${multDesc(effect.loveMult)}`);
    }
    const label = decorLabelFor(state.roomItems, 'loveGainMult');
    if (label && decor.loveGainMult && decor.loveGainMult !== 1) {
      const pct = Math.round(Math.abs(decor.loveGainMult - 1) * 100);
      lines.push(`${label}: love gains ${decor.loveGainMult > 1 ? 'boosted' : 'reduced'} ${pct}%`);
    }
    const neglectMult = petNeglectMult(state);
    const neglectPct = Math.round((neglectMult - 1) * 100);
    if (neglectPct > 0) {
      const minutesSincePet = (Date.now() - (state.lastPetAt ?? Date.now())) / 60000;
      const timeLabel = minutesSincePet < 1 ? 'under a minute' : `${Math.floor(minutesSincePet)}m`;
      lines.push(`Not petted in ${timeLabel}: love drains ${neglectPct}% faster`);
    }
    if (messLabel) lines.push(`${messLabel}: extra love drain`);
  } else if (statKey === 'health') {
    const needKeys = ['food', 'water', 'sleep', 'fun'];
    const lowCount = needKeys.filter((k) => s[k] < 25).length;
    const allGreat = needKeys.every((k) => s[k] >= 60);
    const penaltyActive = lowCount > 0 || messCount > 0;
    if (moodLabel && penaltyActive && effect.healthPenaltyMult && effect.healthPenaltyMult !== 1) {
      lines.push(`${moodLabel}: health penalties ${multDesc(effect.healthPenaltyMult, 'worse', 'milder')}`);
    }
    if (penaltyActive) {
      const label = decorLabelFor(state.roomItems, 'healthDrainMult');
      if (label && decor.healthDrainMult && decor.healthDrainMult !== 1) {
        lines.push(`${label}: health drains ${multDesc(decor.healthDrainMult)}`);
      }
    }
    if (messLabel) lines.push(`${messLabel}: draining health`);
    if (allGreat && messCount === 0) lines.push('All needs met: slowly recovering');
  }
  return lines;
}
