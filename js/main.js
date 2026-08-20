// App entry point: wires state, room, shop, and mini-games together, and
// drives the pet's autonomous behavior (the "AI" loop).

import { loadState, saveState, applyDecay, clamp, makeUid } from './state.js';
import { ITEMS, itemsByCategory, activeDecorEffects } from './items.js';
import { computeEmotion, emotionLine } from './emotions.js';
import { renderMeters, showToast, showSpeech, openModal, closeModal, renderIcon, pulseMoneyDisplay } from './ui.js';
import {
  initRoom, setSleepingVisual, setCustomization, bumpPet, setDecorateMode, setMoveMode,
  walkPetTo, isPetWalking, getPetPosition, setCarryingVisual, setEmotionVisual,
  showHeartParticle, renderRoomItems, appendRoomItem, removeRoomItem, ROOM_BOUNDS, setIdlePose, setMadVisual, playTantrum,
  stopWalking, setPettingVisual, setTripPhase, playScoldFlinch, showMoneyParticle,
  flashMonkeyFallen, playMonkeySlide, isBeingCarried, moveMonkeyTo, setWatchingMonkeyVisual, setLoveFaceVisual,
} from './room.js';
import { openShop } from './shop.js';
import { openPlayMenu } from './minigames/index.js';

const state = loadState();
applyDecay(state); // catch up on time passed while the game was closed

function messCount() {
  return state.roomItems.filter((i) => i.kind === 'mess').length;
}
function currentEmotion() {
  return computeEmotion(state, { messCount: messCount() });
}

// Love is deliberately harder to earn than the other stats — every gain is
// dampened by this before anything else applies, so raising it takes real,
// repeated care rather than a couple of quick actions.
const LOVE_GAIN_MULT = 0.5;

// A candle placed in the room gives a small bonus to every positive love
// gain (not decay) — see DECOR_EFFECTS in items.js. Route every explicit
// love *increase* through here rather than touching state.stats.love
// directly so neither bonus nor dampening is ever missed.
function gainLove(amount) {
  const decorMult = activeDecorEffects(state.roomItems).loveGainMult || 1;
  state.stats.love = clamp(state.stats.love + amount * LOVE_GAIN_MULT * decorMult);
}

// ---- DOM refs shared by the store's persist() (interact-energy meters,
// mood display) and the armed pet/play/exercise/scold interactions further
// down ----
const roomEl = document.getElementById('room');
const btnPetAction = document.getElementById('btn-pet-action');
const btnPlayAction = document.getElementById('btn-play-action');
const btnExerciseAction = document.getElementById('btn-exercise-action');
const btnScoldAction = document.getElementById('btn-scold-action');
const pettingMeterEl = document.getElementById('petting-meter');
const pettingMeterFill = document.getElementById('petting-meter-fill');
const petEnergyFill = document.getElementById('pet-energy-fill');
const playEnergyFill = document.getElementById('play-energy-fill');
const exerciseEnergyFill = document.getElementById('exercise-energy-fill');
const moodLabelEl = document.getElementById('mood-label');
// Energy spent per use of the Pet/Play/Exercise interactions — one shared
// cost and meter mechanic for all three (see INTERACT_ENERGY_REGEN_PER_MIN
// in state.js for how fast each refills on its own).
const INTERACT_ENERGY_COST = 34;
// action key -> { the stat it draws from, its meter's fill element, its
// sidebar button } — lets the gating/rendering below treat all three
// identically instead of three near-duplicate copies.
const INTERACTIONS = {
  pet: { statKey: 'petEnergy', fill: petEnergyFill, btn: btnPetAction },
  play: { statKey: 'playEnergy', fill: playEnergyFill, btn: btnPlayAction },
  exercise: { statKey: 'exerciseEnergy', fill: exerciseEnergyFill, btn: btnExerciseAction },
};
const INTERACT_TIRED_MESSAGE = {
  pet: 'Too tired to be petted — let the meter fill up.',
  play: 'Too tired to play — let the meter fill up.',
  exercise: 'Too tired to exercise — let the meter fill up.',
};

function hasInteractEnergy(action) {
  return state[INTERACTIONS[action].statKey] >= INTERACT_ENERGY_COST;
}
function spendInteractEnergy(action) {
  const key = INTERACTIONS[action].statKey;
  state[key] = clamp(state[key] - INTERACT_ENERGY_COST);
}
function renderInteractEnergyMeters() {
  for (const { statKey, fill, btn } of Object.values(INTERACTIONS)) {
    const val = state[statKey];
    fill.style.width = `${Math.max(0, Math.min(100, val))}%`;
    btn.classList.toggle('energy-empty', val < INTERACT_ENERGY_COST);
  }
}

// What's actually showing on the character's face right now, in the same
// priority order as refreshVisual() in js/room.js: sleeping beats tripping
// beats mad beats the dominant-stat emotion. Kept as one small emoji+label
// map here rather than trying to reuse the character's own face art (those
// SVGs are laid out as one layer of the full 220x320 composite, not
// standalone icons, so they wouldn't crop into a tidy little badge).
const MOOD_INFO = {
  sleeping: { emoji: '😴', label: 'Sleeping' },
  crying: { emoji: '😭', label: 'Crying' },
  mad: { emoji: '😠', label: 'Mad' },
  happy: { emoji: '😊', label: 'Happy' },
  hungry: { emoji: '😟', label: 'Hungry' },
  stuffed: { emoji: '😵', label: 'Stuffed' },
  thirsty: { emoji: '😰', label: 'Thirsty' },
  exhausted: { emoji: '😪', label: 'Exhausted' },
  bored: { emoji: '😑', label: 'Bored' },
  sad: { emoji: '😢', label: 'Sad' },
};

function currentMoodKey() {
  if (state.isSleeping) return 'sleeping';
  if (tripping) return 'crying';
  if (isMad()) return 'mad';
  return currentEmotion();
}

function renderMoodDisplay() {
  const { emoji, label } = MOOD_INFO[currentMoodKey()] || MOOD_INFO.happy;
  moodLabelEl.textContent = `${emoji} ${label}`;
}

const store = {
  state,
  persist() {
    saveState(state);
    renderMeters(state);
    renderInteractEnergyMeters();
    renderMoodDisplay();
    // Sleep can end on its own (state.js auto-wakes at 100 sleep) without
    // any UI click to trigger it, so keep the visual in sync here rather
    // than only where isSleeping is explicitly toggled.
    setSleepingVisual(state.isSleeping);
    setEmotionVisual(currentEmotion());
  },
};

renderMeters(state);
initRoom(store);
setEmotionVisual(currentEmotion());
renderInteractEnergyMeters();
window.addEventListener('outfit-changed', () => setCustomization(state.equipped));

// ---- periodic live decay while the app stays open ----
setInterval(() => {
  applyDecay(state);
  store.persist();
  maybeComplain();
}, 15000);

let lastComplaint = 0;
function maybeComplain() {
  if (state.isSleeping) return;
  const now = Date.now();
  if (now - lastComplaint < 45000) return;
  const emotion = currentEmotion();
  const line = emotionLine(emotion);
  if (line) {
    showSpeech(line);
    lastComplaint = now;
  }
}

// =====================================================================
// Autonomous pet behavior: wanders, seeks out placed food/water on its
// own, carries water around (slowly refilling its water meter) until it
// finishes or randomly drops the glass and makes a mess — and, when there's
// nothing urgent to do, picks a random idle activity (rest / sit / play
// alone) or occasionally just makes a mess out of boredom.
// =====================================================================

const AI_TICK_MS = 1200;
const DROP_CHANCE = 0.08;
const REGEN_WATER_PER_TICK = 3;
const REGEN_FUN_PER_TICK = 0.6;
const WANDER_CHANCE = 0.2;
const RANDOM_MESS_CHANCE = 0.02;
const IDLE_HOLD_CHANCE = 0.15;
const SLEEP_DESIRE_THRESHOLD = 30; // below this, sleep chance starts climbing

// The hungrier/thirstier the pet, the more likely it goes for available
// food/water each tick — but there's always some baseline chance it wanders
// over even when not truly in need, so placed items don't just sit ignored.
function desireChance(statValue) {
  const need = 100 - statValue;
  return 0.1 + (need / 100) * 0.55;
}

// Below SLEEP_DESIRE_THRESHOLD, the chance it nods off climbs the lower
// sleep gets — a small chance right under the threshold, rising toward
// near-certain as it approaches empty. At/above the threshold there's no
// chance at all (it won't randomly sleep while reasonably rested).
function sleepDesireChance(sleepValue) {
  if (sleepValue >= SLEEP_DESIRE_THRESHOLD) return 0;
  const need = SLEEP_DESIRE_THRESHOLD - sleepValue;
  return 0.05 + (need / SLEEP_DESIRE_THRESHOLD) * 0.85;
}

// Irresistible food (see items.js) gets eaten almost no matter how full the
// pet already is — that's what lets food push past 100... er, past the
// "stuffed" threshold instead of politely stopping at "full".
const IRRESISTIBLE_DESIRE = 0.9;
function foodDesire(item) {
  if (item && ITEMS[item.itemId]?.irresistible) return IRRESISTIBLE_DESIRE;
  return desireChance(state.stats.food);
}

// ---- getting mad: a scold leaves the pet mad for a while. While mad it
// won't do anything fun on its own and is much more likely to make a mess
// (a tantrum) instead. ----
const MAD_DURATION_MS = 45000;
const TANTRUM_MESS_CHANCE = 0.1;
let madUntil = 0;

function isMad() {
  return Date.now() < madUntil;
}

function makeMad() {
  madUntil = Date.now() + MAD_DURATION_MS;
  setMadVisual(true);
}

function throwTantrum() {
  const petPos = getPetPosition();
  const p = jitterPoint(petPos.x, petPos.y);
  const subtype = Math.random() < 0.5 ? 'clutter' : 'crumbs';
  state.roomItems.push({ uid: makeUid('mess'), kind: 'mess', subtype, x: p.x, y: p.y, createdAt: Date.now() });
  playTantrum();
  showSpeech(['😡 GRR!', '*throws a tantrum*', "I'm SO mad!"][Math.floor(Math.random() * 3)]);
  renderRoomItems(state);
  store.persist();
}

const IDLE_ACTIVITIES = {
  rest: { pose: 'resting', minMs: 4000, maxMs: 7000, line: '💤 resting...' },
  sit: { pose: 'sitting', minMs: 3000, maxMs: 6000, line: '*sits down*' },
  play: { pose: 'playing-alone', minMs: 3000, maxMs: 5000, line: '🧸 playing alone...', funGain: 3 },
};
let idleActivity = null; // { type, until }

function clearIdleActivity() {
  idleActivity = null;
  setIdlePose(null);
}

// How close the character needs to still be to the pet's *current* spot
// once it arrives to actually play with it — see startIdleActivity()'s
// walk-to-pet callback below.
const MONKEY_PLAY_ARRIVE_RADIUS = 18;

function startIdleActivity(type) {
  const def = IDLE_ACTIVITIES[type];
  // "Playing alone" wanders over to a placed decoration or pet first (a
  // plant, lamp, painting, the monkey, whatever's around — see
  // findPlayTarget()) if there's one to go to; resting/sitting stay put
  // where they are. A pet specifically gets its own two reactions instead
  // of the generic idle-play pose — see playWithMonkey() below.
  const spot = type === 'play' ? findPlayTarget() : null;
  if (spot && spot.kind === 'pet') {
    walkPetTo(spot.x, spot.y, () => {
      // `spot` is the live roomItems entry (not a snapshot), and the pet
      // wanders on its own (see monkeyTick()) — it can move again sometime
      // during this walk, after the walk's own target was already fixed.
      // Re-check its *current* position against where the character
      // actually ended up rather than assuming it's still right there; if
      // it's wandered off in the meantime, skip this attempt instead of
      // "playing" with it from across the room.
      const petPos = getPetPosition();
      if (Math.hypot(spot.x - petPos.x, spot.y - petPos.y) <= MONKEY_PLAY_ARRIVE_RADIUS) {
        playWithMonkey(spot);
      }
    });
    return;
  }

  const begin = () => {
    idleActivity = { type, until: Date.now() + def.minMs + Math.random() * (def.maxMs - def.minMs) };
    setIdlePose(def.pose);
    if (def.funGain) state.stats.fun = clamp(state.stats.fun + def.funGain);
    showSpeech(def.line);
    store.persist();
  };
  if (spot) walkPetTo(spot.x, spot.y, begin);
  else begin();
}

// ---- playing with the monkey: its own two reactions instead of the usual
// "playing alone" bounce, depending on how much love the pet currently has
// for you — this is a bonding moment, not a fun/entertainment one, so it
// reads off the love stat rather than fun. Below half, it's cranky about it
// — a brief tantrum, and the monkey gets knocked onto its side for a couple
// seconds, like it fell over. At half or above, it flops onto its side with
// a heart-eyed "love" face to watch, transfixed, for several seconds longer
// while the monkey slides back and forth in front of it. Either way this
// counts as the 'play' idle activity for aiTick's bookkeeping, just with
// different visuals/rewards/durations. ----
const MONKEY_PLAY_MS = 2200; // low-love tantrum branch — matches monkey-fallen's 2s animation
const MONKEY_WATCH_MS = 5200; // high-love branch — several seconds longer, it stays down watching
const MONKEY_PLAY_LOVE_THRESHOLD = 50;
const MONKEY_SLIDE_LOVE_GAIN = 4;
let monkeyPlayActive = false; // true for the duration — see monkeyTick()'s guard

function playWithMonkey(monkey) {
  monkeyPlayActive = true;
  const highLove = state.stats.love >= MONKEY_PLAY_LOVE_THRESHOLD;
  const duration = highLove ? MONKEY_WATCH_MS : MONKEY_PLAY_MS;
  idleActivity = { type: 'play', until: Date.now() + duration };
  if (!highLove) {
    playTantrum();
    flashMonkeyFallen(monkey.uid);
    showSpeech(['Grr!', '*knocks the monkey over*', '😤'][Math.floor(Math.random() * 3)]);
  } else {
    setWatchingMonkeyVisual(true);
    setLoveFaceVisual(true);
    playMonkeySlide(monkey.uid, MONKEY_WATCH_MS);
    gainLove(MONKEY_SLIDE_LOVE_GAIN);
    showSpeech('hehehe');
  }
  store.persist();
  setTimeout(() => {
    monkeyPlayActive = false;
    if (highLove) {
      setWatchingMonkeyVisual(false);
      setLoveFaceVisual(false);
    }
  }, duration);
}

// ---- the placed pet (monkey/beach monkey/ice monkey): unlike a
// decoration, it wanders the room on its own and occasionally drops a free
// banana. Runs on its own timer independent of the pet's AI loop/gating
// (state.isSleeping etc.) — it keeps doing its thing regardless of what
// the character is up to. ----
const MONKEY_TICK_MS = 2200;
const MONKEY_MOVE_CHANCE = 0.35;
const MONKEY_BANANA_CHANCE = 0.01;
const MONKEY_MAX_BANANAS = 2; // don't let free bananas pile up forever

function monkeyTick() {
  if (monkeyPlayActive) return; // don't rebuild/reposition mid-reaction, see playWithMonkey()
  const monkey = findPet();
  if (!monkey) return;

  // Banana-drop first, so it can never land mid-walk-animation and cut the
  // move's transition/tilt short. Appends just the new banana element
  // (appendRoomItem) instead of a full renderRoomItems() rebuild — a
  // rebuild would recreate the monkey's own element too, and doing that
  // immediately before this same tick's possible moveMonkeyTo() call below
  // could eat that move's transition entirely (see moveMonkeyTo()'s
  // comment in room.js) and make the monkey appear to teleport.
  const bananaCount = state.roomItems.filter((i) => i.kind === 'food' && i.itemId === 'banana').length;
  if (bananaCount < MONKEY_MAX_BANANAS && Math.random() < MONKEY_BANANA_CHANCE) {
    const banana = { uid: makeUid('banana'), kind: 'food', itemId: 'banana', x: monkey.x, y: monkey.y, effect: { ...ITEMS.banana.effect } };
    state.roomItems.push(banana);
    appendRoomItem(banana);
    store.persist();
  }

  if (!isBeingCarried(monkey.uid) && Math.random() < MONKEY_MOVE_CHANCE) {
    const p = randomFloorPoint();
    monkey.x = p.x;
    monkey.y = p.y;
    moveMonkeyTo(monkey);
    store.persist();
  }
}

// ---- tripping: a small chance each tick to stumble — the messier the
// room, the higher that chance climbs (there's more to trip over). A trip
// freezes the AI loop for a couple of seconds lying on its side with a
// crying face, then a couple more seconds sitting up still crying, before
// returning to normal — see setTripPhase() in js/room.js for the visuals.
// It hurts: an instant hit to health and fun, and if it's out carrying a
// drink when it happens, the drink goes flying — several spills, not the
// usual single accidental-drop mess, and it's gone for good rather than
// gently set down. Petting it during the "sitting and crying" half comforts
// it — recovers part of that lost health/fun and a little love — see
// comfortDuringTrip() and its hook into startPetting() below. ----
const TRIP_BASE_CHANCE = 0.004;
const TRIP_CHANCE_PER_MESS = 0.008;
const TRIP_MAX_CHANCE = 0.15;
const TRIP_FALL_MS = 2200;
const TRIP_CRY_SIT_MS = 2200;
const TRIP_HEALTH_DAMAGE = 6;
const TRIP_FUN_DAMAGE = 10;
const TRIP_SPILL_COUNT = 3;
const TRIP_RECOVERY_FRACTION = 0.5; // how much of the trip's own damage one comforting pet undoes
const TRIP_RECOVERY_LOVE = 4;
let tripping = false;
let tripRecovering = false; // true only during the "sitting up, still crying" half
let tripComforted = false; // whether this trip's one-time comfort-pet has already been used
let tripDamage = { health: 0, fun: 0 };

function tripChance(messes) {
  return Math.min(TRIP_MAX_CHANCE, TRIP_BASE_CHANCE + messes * TRIP_CHANCE_PER_MESS);
}

function triggerTrip() {
  tripping = true;
  tripRecovering = false;
  tripComforted = false;
  stopWalking();
  clearIdleActivity();

  tripDamage = { health: TRIP_HEALTH_DAMAGE, fun: TRIP_FUN_DAMAGE };
  state.stats.health = clamp(state.stats.health - TRIP_HEALTH_DAMAGE);
  state.stats.fun = clamp(state.stats.fun - TRIP_FUN_DAMAGE);

  if (carrying) {
    const petPos = getPetPosition();
    for (let i = 0; i < TRIP_SPILL_COUNT; i++) {
      const p = jitterPoint(petPos.x, petPos.y, 16);
      state.roomItems.push({ uid: makeUid('mess'), kind: 'mess', subtype: 'spill', x: p.x, y: p.y, createdAt: Date.now() });
    }
    carrying = null; // gone for good — this isn't a gentle set-down like falling asleep mid-carry
    setCarryingVisual(null);
    renderRoomItems(state);
  }

  const dir = Math.random() < 0.5 ? 1 : -1;
  setTripPhase('falling', dir);
  showSpeech(['Ow!', '*trips*', 'Oof!'][Math.floor(Math.random() * 3)]);
  bumpPet();
  store.persist();
  setTimeout(() => {
    tripRecovering = true;
    setTripPhase('sitting');
    store.persist();
    setTimeout(() => {
      tripping = false;
      tripRecovering = false;
      setTripPhase(null);
      store.persist();
    }, TRIP_CRY_SIT_MS);
  }, TRIP_FALL_MS);
}

// One-time comforting pet during the "sitting and crying" half of a trip —
// see startPetting()'s hook below. Doesn't run the normal hold-and-fill
// petting session; this is its own small, instant gesture.
function comfortDuringTrip() {
  if (tripComforted) return;
  tripComforted = true;
  state.stats.health = clamp(state.stats.health + tripDamage.health * TRIP_RECOVERY_FRACTION);
  state.stats.fun = clamp(state.stats.fun + tripDamage.fun * TRIP_RECOVERY_FRACTION);
  gainLove(TRIP_RECOVERY_LOVE);
  showHeartParticle();
  showSpeech(['There, there...', '💗', "It's okay..."][Math.floor(Math.random() * 3)]);
  bumpPet();
  setPendingInteraction(null);
  store.persist();
}

function makeRandomMess() {
  const petPos = getPetPosition();
  const p = jitterPoint(petPos.x, petPos.y);
  const subtype = Math.random() < 0.5 ? 'clutter' : 'crumbs';
  state.roomItems.push({ uid: makeUid('mess'), kind: 'mess', subtype, x: p.x, y: p.y, createdAt: Date.now() });
  showSpeech('*makes a mess*');
  renderRoomItems(state);
  store.persist();
}

let carrying = null; // { uid, itemId, icon, remaining: {water, fun?} }

function randomFloorPoint() {
  const { MIN_X, MAX_X, MIN_Y, MAX_Y } = ROOM_BOUNDS;
  return { x: MIN_X + Math.random() * (MAX_X - MIN_X), y: MIN_Y + Math.random() * (MAX_Y - MIN_Y) };
}

// Nudges a spot by a random amount so messes don't all land at the exact
// same coordinate (e.g. a dropped glass would otherwise always spill right
// at wherever it was placed, since a drop can happen on the very first tick
// after pickup, before any wandering).
function jitterPoint(x, y, radius = 10) {
  const { MIN_X, MAX_X, MIN_Y, MAX_Y } = ROOM_BOUNDS;
  return {
    x: Math.max(MIN_X, Math.min(MAX_X, x + (Math.random() * 2 - 1) * radius)),
    y: Math.max(MIN_Y, Math.min(MAX_Y, y + (Math.random() * 2 - 1) * radius * 0.7)),
  };
}

function findRoomItem(kind) {
  return state.roomItems.find((i) => i.kind === kind);
}

// Decorations the pet actually walks over to use for a specific activity
// (eating at a table, sleeping in a bed) rather than just standing around
// looking at — see ACTIVITY_DECOR below. "Playing alone" is the opposite:
// any placed decoration *except* these two counts as somewhere to wander
// over to and play near (plant, lamp, painting, candle, chair, window,
// whatever else gets added later) — see findPlayTarget().
const ACTIVITY_DECOR = { sleep: 'bed', eat: 'table' };

function findDecoration(itemId) {
  return state.roomItems.find((i) => i.kind === 'decoration' && i.itemId === itemId);
}

// Any placed pet (the monkey or one of its beach/ice variants — see
// items.js) — kind:'pet' rather than an itemId check, so a new pet variant
// doesn't need any changes here. Only one is expected to meaningfully be
// "the" active pet at a time; if more than one somehow ends up placed, this
// just always picks the first (matches array order), and the rest sit
// there as plain (if oversized) decoration until removed.
function findPet() {
  return state.roomItems.find((i) => i.kind === 'pet');
}

// The pet's favorite thing to play with — weighted so a placed pet comes
// up several times more often than any other single decoration, without
// being the *only* thing that ever gets picked.
const MONKEY_PLAY_WEIGHT = 4;

function findPlayTarget() {
  const reserved = new Set(Object.values(ACTIVITY_DECOR));
  const decorCandidates = state.roomItems.filter((i) => i.kind === 'decoration' && !reserved.has(i.itemId));
  const pet = findPet();
  const pool = pet ? [...decorCandidates, ...Array(MONKEY_PLAY_WEIGHT).fill(pet)] : decorCandidates;
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function eatAt(item, spot) {
  state.roomItems = state.roomItems.filter((i) => i.uid !== item.uid);
  for (const [key, val] of Object.entries(item.effect)) {
    state.stats[key] = clamp(state.stats[key] + val);
  }
  gainLove(1);
  bumpPet();
  showSpeech('Yum! 😋');
  // Some food always leaves a specific mess behind when eaten (a banana's
  // peel — see messOnEat in items.js) rather than the usual small chance of
  // generic crumbs everything else has.
  const messSubtype = ITEMS[item.itemId]?.messOnEat;
  if (messSubtype) {
    const p = jitterPoint(spot.x, spot.y);
    state.roomItems.push({ uid: makeUid('mess'), kind: 'mess', subtype: messSubtype, x: p.x, y: p.y, createdAt: Date.now() });
  } else if (Math.random() < 0.15) {
    const p = jitterPoint(spot.x, spot.y);
    state.roomItems.push({ uid: makeUid('mess'), kind: 'mess', subtype: 'crumbs', x: p.x, y: p.y, createdAt: Date.now() });
  }
  renderRoomItems(state);
  store.persist();
}

function goEat(item) {
  const table = findDecoration(ACTIVITY_DECOR.eat);
  if (!table) {
    // no table — eat right where the food already is, same as before
    walkPetTo(item.x, item.y, () => eatAt(item, item));
    return;
  }
  // Bring the food to the table: walk to the bowl first, pick it up (it
  // disappears from its own spot and travels with the pet, same little
  // carried-icon treatment as a glass of water — see setCarryingVisual() in
  // room.js), then walk it over to the table and eat there.
  walkPetTo(item.x, item.y, () => {
    state.roomItems = state.roomItems.filter((i) => i.uid !== item.uid);
    setCarryingVisual(ITEMS[item.itemId].icon);
    renderRoomItems(state);
    store.persist();
    walkPetTo(table.x, table.y, () => {
      setCarryingVisual(null);
      eatAt(item, table);
    });
  });
}

function goDrink(item) {
  walkPetTo(item.x, item.y, () => {
    state.roomItems = state.roomItems.filter((i) => i.uid !== item.uid);
    carrying = { uid: item.uid, itemId: item.itemId, icon: ITEMS[item.itemId].icon, remaining: { ...item.effect } };
    setCarryingVisual(carrying.icon);
    showSpeech('Got it!');
    renderRoomItems(state);
    store.persist();
  });
}

function dropCarriedWater() {
  const petPos = getPetPosition();
  const p = jitterPoint(petPos.x, petPos.y);
  state.roomItems.push({ uid: makeUid('mess'), kind: 'mess', subtype: 'spill', x: p.x, y: p.y, createdAt: Date.now() });
  carrying = null;
  setCarryingVisual(null);
  state.stats.fun = clamp(state.stats.fun - 3);
  showSpeech('Oops! 💦');
  renderRoomItems(state);
  store.persist();
}

function finishCarriedWater() {
  carrying = null;
  setCarryingVisual(null);
  showSpeech('Ahh, refreshing!');
  store.persist();
}

// The pet decides for itself when it's tired enough to sleep — there's no
// manual sleep toggle. Naps are random-length: it wakes up on its own once
// sleep decays back up to a randomly chosen target rather than always
// requiring a full recharge to 100 (see applyDecay in state.js).
const NAP_TARGET_MIN = 30;
const NAP_TARGET_MAX = 100;
function goToSleep() {
  clearIdleActivity();
  if (carrying) {
    // gently set the glass down instead of losing it or spilling — right
    // here, before heading to bed, not carrying it all the way there
    const p = getPetPosition();
    state.roomItems.push({ uid: makeUid(carrying.itemId), kind: 'water', itemId: carrying.itemId, x: p.x, y: p.y, effect: carrying.remaining });
    carrying = null;
    setCarryingVisual(null);
    renderRoomItems(state);
    store.persist();
  }

  const startSleeping = () => {
    state.isSleeping = true;
    state.sleepTarget = NAP_TARGET_MIN + Math.random() * (NAP_TARGET_MAX - NAP_TARGET_MIN);
    showSpeech('😴 so sleepy...');
    store.persist();
  };

  // Walks over to a placed bed first if there is one — see ACTIVITY_DECOR
  // above — otherwise just falls asleep on the spot like before.
  const bed = findDecoration(ACTIVITY_DECOR.sleep);
  if (bed) walkPetTo(bed.x, bed.y, startSleeping);
  else startSleeping();
}

function aiTick() {
  if (state.isSleeping || petting || tripping) return;

  if (madUntil > 0 && Date.now() >= madUntil) {
    madUntil = 0;
    setMadVisual(false);
    renderMoodDisplay();
  }

  // Can happen anytime it's up and about — walking (toward food, water, its
  // table/bed, a play spot, or just wandering) or standing/carrying in
  // place — but not while it's settled into a held idle activity (resting,
  // sitting, playing alone; being asleep is already covered by the guard
  // at the top of this function). Those are the "it's idle, leave it be"
  // states — everything else is fair game, same as actually being awake.
  if (!idleActivity && Math.random() < tripChance(messCount())) {
    triggerTrip();
    return;
  }

  if (carrying) {
    if (isPetWalking()) return;
    const rem = carrying.remaining;
    if ((rem.water || 0) > 0) {
      const amt = Math.min(REGEN_WATER_PER_TICK, rem.water);
      state.stats.water = clamp(state.stats.water + amt);
      rem.water -= amt;
    }
    if ((rem.fun || 0) > 0) {
      const amt = Math.min(REGEN_FUN_PER_TICK, rem.fun);
      state.stats.fun = clamp(state.stats.fun + amt);
      rem.fun -= amt;
    }
    const done = (rem.water || 0) <= 0.01 && (rem.fun || 0) <= 0.01;

    if (!done && Math.random() < DROP_CHANCE) {
      dropCarriedWater();
    } else if (done) {
      finishCarriedWater();
    } else {
      if (Math.random() < 0.35) {
        const p = randomFloorPoint();
        walkPetTo(p.x, p.y);
      }
      store.persist();
    }
    return;
  }

  if (isPetWalking()) return;

  if (Math.random() < sleepDesireChance(state.stats.sleep)) {
    goToSleep();
    return;
  }

  if (idleActivity) {
    const urgent = state.stats.food < 20 || state.stats.water < 20;
    if (urgent) {
      clearIdleActivity();
    } else if (Date.now() < idleActivity.until) {
      return; // still mid rest/sit/play, nothing else to decide this tick
    } else {
      clearIdleActivity();
    }
  }

  const foodItem = findRoomItem('food');
  const waterItem = findRoomItem('water');
  const wantsFood = foodItem && Math.random() < foodDesire(foodItem);
  const wantsWater = waterItem && Math.random() < desireChance(state.stats.water);

  if (wantsFood && (!wantsWater || state.stats.food <= state.stats.water)) {
    goEat(foodItem);
    return;
  }
  if (wantsWater) {
    goDrink(waterItem);
    return;
  }

  const mad = isMad();
  if (Math.random() < (mad ? TANTRUM_MESS_CHANCE : RANDOM_MESS_CHANCE)) {
    if (mad) throwTantrum(); else makeRandomMess();
    return;
  }
  if (Math.random() < WANDER_CHANCE) {
    const p = randomFloorPoint();
    walkPetTo(p.x, p.y);
    return;
  }
  if (Math.random() < IDLE_HOLD_CHANCE) {
    // a mad pet won't do anything fun on its own — no playing alone
    const types = mad ? ['rest', 'sit'] : Object.keys(IDLE_ACTIVITIES);
    startIdleActivity(types[Math.floor(Math.random() * types.length)]);
  }
}

setInterval(aiTick, AI_TICK_MS);
setInterval(monkeyTick, MONKEY_TICK_MS);
renderMoodDisplay(); // initial paint — everything currentMoodKey() reads is declared by this point

// ---- direct interactions: pet / play / exercise / scold. None of them
// fire the moment you click their sidebar button anymore — clicking one
// "arms" it (the cursor over the room swaps to that action's icon) and it
// only actually happens once you click the character with it armed.
// Clicking anything else while armed cancels it instead of doing nothing. ----
const ARM_BUTTONS = { pet: btnPetAction, play: btnPlayAction, exercise: btnExerciseAction, scold: btnScoldAction };
let pendingInteraction = null; // 'pet' | 'play' | 'exercise' | 'scold' | null

function setPendingInteraction(action) {
  if (pendingInteraction) ARM_BUTTONS[pendingInteraction].classList.remove('active-mode');
  pendingInteraction = action;
  roomEl.classList.remove('armed-pet', 'armed-play', 'armed-exercise', 'armed-scold');
  if (action) {
    roomEl.classList.add(`armed-${action}`);
    ARM_BUTTONS[action].classList.add('active-mode');
  }
}

function toggleInteraction(action) {
  if (pendingInteraction === action) { setPendingInteraction(null); return; }
  if (INTERACTIONS[action] && !hasInteractEnergy(action)) {
    showToast(INTERACT_TIRED_MESSAGE[action]);
    return;
  }
  // arming an interaction cancels decorate/move mode, same as those two
  // already cancel each other
  if (decorateMode) { decorateMode = false; setDecorateMode(false); btnDecorate.classList.remove('active-mode'); }
  if (moveMode) { moveMode = false; setMoveMode(false); btnMove.classList.remove('active-mode'); }
  setPendingInteraction(action);
}

btnPetAction.addEventListener('click', () => toggleInteraction('pet'));
btnPlayAction.addEventListener('click', () => toggleInteraction('play'));
btnExerciseAction.addEventListener('click', () => toggleInteraction('exercise'));
btnScoldAction.addEventListener('click', () => toggleInteraction('scold'));

// Any click that isn't on the character (or the sidebar itself, so
// re-clicking a button doesn't first get treated as a stray "elsewhere"
// click) cancels whichever interaction is armed.
document.addEventListener('click', (e) => {
  if (!pendingInteraction) return;
  if (e.target.closest('#pet-visual') || e.target.closest('#interact-bar')) return;
  setPendingInteraction(null);
}, true);

// Waking a sleeping pet up to poke/feed/play with it is a big deal — it
// tanks love and fun hard, on top of whatever the attempted action would
// normally have done (which never applies; the interaction is refused).
const SLEEP_DISTURB_PENALTY = 30;
function disturbSleep() {
  state.stats.love = clamp(state.stats.love - SLEEP_DISTURB_PENALTY);
  state.stats.fun = clamp(state.stats.fun - SLEEP_DISTURB_PENALTY);
  state.isSleeping = false;
  setSleepingVisual(false); // apply immediately so the tantrum flash below isn't clobbered by a later persist()
  makeMad();
  bumpPet();
  showToast("You woke it up — now it's mad!");
  throwTantrum();
  setPendingInteraction(null);
}

// ---- petting: click-and-hold on the character while "Pet" is armed. The
// pet holds still the whole time (see stopWalking()) and a meter fills for
// as long as you keep holding — release to cash the hold in as love/fun,
// but fill the meter all the way and it tips into annoyed instead (too much
// of a good thing — see overpetted()). ----
const PET_METER_FILL_PER_SEC = 35;
let petting = false;
let pettingValue = 0;
let pettingLastTs = 0;
let pettingRaf = null;

function updatePettingMeterVisual() {
  pettingMeterFill.style.width = `${Math.min(100, pettingValue)}%`;
  pettingMeterFill.classList.toggle('too-much', pettingValue > 70);
}

function pettingLoop(ts) {
  if (!petting) return;
  const dt = pettingLastTs ? (ts - pettingLastTs) / 1000 : 0;
  pettingLastTs = ts;
  pettingValue += PET_METER_FILL_PER_SEC * dt;
  updatePettingMeterVisual();
  if (pettingValue >= 100) { overpetted(); return; }
  gainLove(dt * 4);
  state.stats.fun = clamp(state.stats.fun + dt * 1.5);
  store.persist();
  pettingRaf = requestAnimationFrame(pettingLoop);
}

function startPetting() {
  if (pendingInteraction !== 'pet' || petting) return;
  if (state.isSleeping) { disturbSleep(); return; }
  // Comforting a pet through the "sitting and crying" half of a trip is its
  // own small one-time gesture, not the usual hold-and-fill session — see
  // comfortDuringTrip(). Mid-fall (tripping but not yet tripRecovering)
  // just no-ops; there's nothing to pet yet.
  if (tripRecovering) { comfortDuringTrip(); return; }
  if (tripping) return;
  // Mid-reaction with a placed pet (see playWithMonkey()): same "nothing to
  // pet right now" no-op as tripping, and for the same underlying reason —
  // the high-love reaction's watching-monkey pose and the petting bounce
  // both set #pet-visual's transform via a plain (non-animation) CSS rule,
  // so letting them overlap would have one silently win over the other
  // instead of blending, the same static-transform clash tripping already
  // avoids by blocking petting outright.
  if (monkeyPlayActive) return;
  // Energy could have drained since Pet was armed (toggleInteraction's own
  // check), so re-check right before the hold actually starts — same
  // double-check doPlayInteraction() does. Spent once per hold session, not
  // per frame, same as Play's one-time cost per click.
  if (!hasInteractEnergy('pet')) {
    showToast(INTERACT_TIRED_MESSAGE.pet);
    setPendingInteraction(null);
    return;
  }
  spendInteractEnergy('pet');
  state.lastPetAt = Date.now(); // resets how fast love drains from neglect — see petNeglectMult() in js/state.js
  petting = true;
  pettingValue = 0;
  pettingLastTs = 0;
  stopWalking();
  clearIdleActivity();
  setPettingVisual(true);
  pettingMeterEl.classList.remove('hidden');
  updatePettingMeterVisual();
  pettingRaf = requestAnimationFrame(pettingLoop);
}

function endPetting() {
  if (!petting) return;
  petting = false;
  if (pettingRaf) cancelAnimationFrame(pettingRaf);
  pettingRaf = null;
  setPettingVisual(false);
  pettingMeterEl.classList.add('hidden');
  showHeartParticle();
  showSpeech(['❤️', '*happy wiggle*', '😊'][Math.floor(Math.random() * 3)]);
  bumpPet();
  setPendingInteraction(null);
  store.persist();
}

function overpetted() {
  petting = false;
  pettingRaf = null;
  setPettingVisual(false);
  pettingMeterEl.classList.add('hidden');
  makeMad();
  showSpeech(["That's enough!", '😠 Too much!', 'Okay, okay!'][Math.floor(Math.random() * 3)]);
  bumpPet();
  setPendingInteraction(null);
  store.persist();
}

window.addEventListener('pet-pressed', startPetting);
window.addEventListener('mouseup', endPetting);
window.addEventListener('touchend', endPetting);

// ---- play: a single click on the character while "Play" is armed, drawing
// from its own stamina-like energy meter (see INTERACT_ENERGY_COST above)
// instead of a flat cooldown — empty it and you have to wait for it to
// refill. ----
function doPlayInteraction() {
  if (state.isSleeping) { disturbSleep(); return; }
  if (!hasInteractEnergy('play')) {
    showToast(INTERACT_TIRED_MESSAGE.play);
    setPendingInteraction(null);
    return;
  }
  spendInteractEnergy('play');
  state.stats.fun = clamp(state.stats.fun + 10);
  gainLove(2);
  state.stats.sleep = clamp(state.stats.sleep - 4);
  bumpPet();
  showSpeech(['Yay!', 'Again, again!', '🧸'][Math.floor(Math.random() * 3)]);
  setPendingInteraction(null);
  store.persist();
}

// ---- exercise: also a single click on the character while armed, drawing
// from its own energy meter exactly like Play — burns off food and water
// (working out costs calories and hydration) but pays back a little health
// and fun (the fitness benefit). ----
const EXERCISE_FOOD_COST = 12;
const EXERCISE_WATER_COST = 8;
const EXERCISE_HEALTH_GAIN = 4;
const EXERCISE_FUN_GAIN = 4;
function doExerciseInteraction() {
  if (state.isSleeping) { disturbSleep(); return; }
  if (!hasInteractEnergy('exercise')) {
    showToast(INTERACT_TIRED_MESSAGE.exercise);
    setPendingInteraction(null);
    return;
  }
  spendInteractEnergy('exercise');
  state.stats.food = clamp(state.stats.food - EXERCISE_FOOD_COST);
  state.stats.water = clamp(state.stats.water - EXERCISE_WATER_COST);
  state.stats.health = clamp(state.stats.health + EXERCISE_HEALTH_GAIN);
  state.stats.fun = clamp(state.stats.fun + EXERCISE_FUN_GAIN);
  bumpPet();
  showSpeech(['Huff... puff...', '💪', 'Phew!'][Math.floor(Math.random() * 3)]);
  setPendingInteraction(null);
  store.persist();
}

// ---- scold: also a single click on the character while armed, no meter ----
// Oddly, it also turns up a little pocket change — a small random coin
// bonus shown as a floating "+X" over its head plus a gold flash on the
// topbar counter (see showMoneyParticle()/pulseMoneyDisplay()), same spirit
// as the heart particle petting shows.
const SCOLD_MONEY_MIN = 1;
const SCOLD_MONEY_MAX = 4;
function doScoldInteraction() {
  if (state.isSleeping) { disturbSleep(); return; }
  state.stats.love = clamp(state.stats.love - 6);
  state.stats.fun = clamp(state.stats.fun - 5);
  makeMad();
  playScoldFlinch();
  const coins = SCOLD_MONEY_MIN + Math.floor(Math.random() * (SCOLD_MONEY_MAX - SCOLD_MONEY_MIN + 1));
  state.money += coins;
  showMoneyParticle(coins);
  pulseMoneyDisplay();
  showSpeech(['Sorry...', '😢', '...'][Math.floor(Math.random() * 3)]);
  setPendingInteraction(null);
  store.persist();
}

window.addEventListener('pet-clicked', () => {
  if (pendingInteraction === 'play') doPlayInteraction();
  else if (pendingInteraction === 'exercise') doExerciseInteraction();
  else if (pendingInteraction === 'scold') doScoldInteraction();
  // 'pet' is handled entirely by pet-pressed/mouseup above (a click alone,
  // with no hold, just ends the session with ~0 on the meter)
});

// ---- cleaning messes ----
window.addEventListener('mess-clicked', (e) => {
  const { uid } = e.detail;
  const mess = state.roomItems.find((i) => i.uid === uid);
  if (!mess) return;
  state.roomItems = state.roomItems.filter((i) => i.uid !== uid);
  gainLove(3);
  state.stats.fun = clamp(state.stats.fun + 5);
  showSpeech('Sparkly clean! ✨');
  // Removes just the cleaned mess's own element instead of a full
  // renderRoomItems() rebuild — a rebuild would restart every *other*
  // mess's wobble animation (see .room-item.kind-mess in css/style.css)
  // back in sync with each other, and could eat the monkey's own move
  // transition mid-flight (see moveMonkeyTo()'s comment in room.js) —
  // reading as every mess resetting and the monkey randomly teleporting.
  removeRoomItem(uid);
  store.persist();
});

// ---- returning a placed item to inventory (decorate-mode removal) ----
window.addEventListener('room-item-removed', (e) => {
  const { item } = e.detail;
  if (item.kind === 'food' || item.kind === 'water') {
    state.inventory[item.itemId] = (state.inventory[item.itemId] || 0) + 1;
    store.persist();
    showToast('Returned to your backpack.');
  } else {
    showToast('Removed.');
  }
});

// ---- item usage (place food/water, use medicine) ----
function useItemModal(category, title) {
  const items = itemsByCategory(category);
  const isPlaceable = category === 'food' || category === 'water';
  const rows = items
    .map((item) => {
      const count = state.inventory[item.id] || 0;
      const actionAttr = isPlaceable ? `data-place="${item.id}"` : `data-use="${item.id}"`;
      const label = isPlaceable ? 'Place in room' : 'Use';
      return `
        <div class="item-card">
          <div class="item-icon">${renderIcon(item.icon)}</div>
          <div class="item-name">${item.name}</div>
          <div class="item-desc">${Object.entries(item.effect).map(([k, v]) => `+${v} ${k}`).join(', ')}</div>
          <div class="item-owned">Have: ${count}</div>
          <button class="use-btn" ${actionAttr} ${count > 0 ? '' : 'disabled'} style="${count > 0 ? '' : 'opacity:.5;cursor:not-allowed;'}">${label}</button>
        </div>`;
    })
    .join('');

  const helpText = isPlaceable
    ? `<p style="font-size:12px;color:var(--ink-soft);">Placed items go in the room — your pet will eat/drink on its own when it wants to.</p>`
    : '';

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <h2>${title}</h2>
    ${helpText}
    ${items.some((i) => (state.inventory[i.id] || 0) > 0)
      ? `<div class="item-grid">${rows}</div>`
      : `<p>You don't have any yet — visit the 🛍️ Shop!</p><div class="item-grid">${rows}</div>`}
  `;
  openModal(wrap);
  wrap.addEventListener('click', (e) => {
    const placeBtn = e.target.closest('[data-place]');
    const useBtn = e.target.closest('[data-use]');
    if (placeBtn) { placeInRoom(placeBtn.dataset.place, category); closeModal(); }
    else if (useBtn) { useItem(useBtn.dataset.use); closeModal(); }
  });
}

function placeInRoom(itemId, kind) {
  const item = ITEMS[itemId];
  const count = state.inventory[itemId] || 0;
  if (count <= 0) return;
  state.inventory[itemId] = count - 1;
  state.roomItems.push({
    uid: makeUid(itemId),
    kind,
    itemId,
    x: 20 + Math.random() * 60,
    y: 58 + Math.random() * 25,
    effect: { ...item.effect },
  });
  store.persist();
  renderRoomItems(state);
  showToast(`Placed ${item.name} in the room.`);
}

function useItem(itemId) {
  const item = ITEMS[itemId];
  const count = state.inventory[itemId] || 0;
  if (count <= 0) return;
  if (state.isSleeping) {
    disturbSleep();
    return;
  }
  state.inventory[itemId] = count - 1;
  for (const [key, val] of Object.entries(item.effect)) {
    state.stats[key] = clamp(state.stats[key] + val);
  }
  store.persist();
  bumpPet();
  showSpeech('Better already!');
  showToast(`Used ${item.name}.`);
}

// ---- action bar ----
document.getElementById('btn-feed').addEventListener('click', () => useItemModal('food', '🍽️ Feed'));
document.getElementById('btn-water').addEventListener('click', () => useItemModal('water', '💧 Give Water'));
document.getElementById('btn-play').addEventListener('click', () => openPlayMenu(store));
document.getElementById('btn-shop').addEventListener('click', () => openShop(store));

// ---- secret dev button: +100 coins, for testing ----
document.getElementById('btn-dev-coins').addEventListener('click', () => {
  state.money += 100;
  store.persist();
  showToast('+100 coins (dev)');
});

document.querySelector('.meter[data-stat="health"]').addEventListener('click', () => useItemModal('medicine', '❤️ Health'));
document.querySelector('.meter[data-stat="food"]').addEventListener('click', () => useItemModal('food', '🍽️ Feed'));
document.querySelector('.meter[data-stat="water"]').addEventListener('click', () => useItemModal('water', '💧 Give Water'));
document.querySelectorAll('.meter').forEach((m) => (m.style.cursor = 'pointer'));

// Decorate mode and Move mode both change what a floor click does, so only
// one can be active at a time.
let decorateMode = false;
let moveMode = false;
const btnDecorate = document.getElementById('btn-decorate');
const btnMove = document.getElementById('btn-move');

btnDecorate.addEventListener('click', () => {
  decorateMode = !decorateMode;
  if (decorateMode) {
    if (moveMode) { moveMode = false; setMoveMode(false); btnMove.classList.remove('active-mode'); }
    if (pendingInteraction) setPendingInteraction(null);
  }
  setDecorateMode(decorateMode);
  btnDecorate.classList.toggle('active-mode', decorateMode);
  showToast(decorateMode ? 'Decorate mode: click to pick up, click again to place.' : 'Decorate mode off.');
});

btnMove.addEventListener('click', () => {
  moveMode = !moveMode;
  if (moveMode) {
    if (decorateMode) { decorateMode = false; setDecorateMode(false); btnDecorate.classList.remove('active-mode'); }
    if (pendingInteraction) setPendingInteraction(null);
  }
  setMoveMode(moveMode);
  btnMove.classList.toggle('active-mode', moveMode);
  showToast(moveMode ? 'Move mode: click the floor to send your pet there.' : 'Move mode off.');
});

// ---- save on tab close too ----
window.addEventListener('beforeunload', () => saveState(state));
