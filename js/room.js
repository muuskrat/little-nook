// Renders the pet + room items (decorations, placed food/water, messes)
// inside the 2.5D room. Handles click-to-walk movement (gated behind "Move"
// mode — see setMoveMode), decoration drag/placement, the modular emotion
// sprite swap, and the visual side of carrying a water glass. All
// *behavior* decisions (when to eat, when to drop the glass, what
// petting/playing/scolding do to stats) live in main.js — this module only
// renders state and reports raw user input back via DOM CustomEvents:
//   'pet-pressed' — mousedown/touchstart on the character. Doesn't mean
//     anything on its own; main.js only starts a petting hold session if
//     "Pet" happens to be armed (see pendingInteraction there) when it fires.
//   'pet-clicked' — a full click on the character, used by main.js for
//     single-shot Play/Scold activation when one of those is armed.
//   'mess-clicked' with detail {uid}         — clicked a mess (clean it)
//   'room-item-removed' with detail {item}   — decorate-mode removal

import { ITEMS, decorEffectDescription } from './items.js';
import { emotionAssetPaths, emotionEffect } from './emotions.js';
import { renderIcon } from './ui.js';

const roomEl = document.getElementById('room');
const floorEl = document.getElementById('room-floor');
const petWrap = document.getElementById('pet-wrap');
const petVisual = document.getElementById('pet-visual');
const layerBody = document.getElementById('layer-body');
const layerEars = document.getElementById('layer-ears');
const layerHead = document.getElementById('layer-head');
const layerFace = document.getElementById('layer-face');
const itemsLayer = document.getElementById('room-items-layer');
const carrySlot = document.getElementById('carry-slot');
const nameTag = document.getElementById('pet-name-tag');
const storageBtn = document.getElementById('btn-storage');

const MIN_X = 8, MAX_X = 92;
const MIN_Y = 12, MAX_Y = 92;
export const ROOM_BOUNDS = { MIN_X, MAX_X, MIN_Y, MAX_Y };
const BASE_SPEED_PCT_PER_SEC = 14; // walking speed in floor-space % per second
const BASE_SIZE = { decoration: 34, food: 26, water: 26, mess: 28 };
// The monkey renders much bigger than a normal decoration — roughly the
// character's own base size (see #pet-visual's width in css/style.css) —
// so it scales with room depth exactly the way the character does, rather
// than being sized like a little icon (see MONKEY_BASE_SIZE's use in
// renderRoomItems() and moveMonkeyTo() below).
const MONKEY_BASE_SIZE = 96; // calibrated to the character's own *width* (96px, see #pet-visual in css/style.css)
// The character's own on-screen box is 96x140px — a portrait rectangle, not
// a square — so matching MONKEY_BASE_SIZE to its width alone still leaves
// renderIcon()'s default 1em-by-1em square box too short. This stretches
// just the pet's own <img> taller to the same 96:140 ratio (applied to the
// image rather than the whole .room-item element, since font-size — driving
// both MONKEY_BASE_SIZE and the resize/depth-scale math elsewhere — stays a
// single number representing the *width*).
const MONKEY_HEIGHT_RATIO = 140 / 96;
const MONKEY_WALK_MS = 1400; // must match .monkey-decor's left/top transition duration in css/style.css
const MIN_DECOR_SCALE = 0.5;
const MAX_DECOR_SCALE = 3.2;
const MESS_ICONS = {
  spill: 'assets/icons/mess/spill.png',
  crumbs: 'assets/icons/mess/crumbs.png',
  clutter: 'assets/icons/mess/clutter.png',
  peel: 'assets/icons/mess/banana-peel.png',
};

// Body art is organized as one folder per outfit (see items.js's
// body_regular/body_bikini/body_snow — same body, different clothes), each
// containing the exact same set of pose files. Picking the right image is
// always "outfit folder + pose key" — see bodyPath() below. Face art
// doesn't vary by outfit, only by mood.
const SLEEP_FACE = 'assets/character/parts/face/face-sleeping.png';
const SLEEP_POSE = 'sleeping';
const MAD_FACE = 'assets/character/parts/face/face-mad.png';
const LOVE_FACE = 'assets/character/parts/face/face-love.png';
const EXHAUSTED_FACE = 'assets/character/parts/face/face-exhausted.png';
const TANTRUM_POSE = 'tantrum';
const CRYING_FACE = 'assets/character/parts/face/face-crying.png';
const TRIP_FALL_POSE = 'tripped';
const TRIP_SIT_POSE = 'sitting'; // reuses the regular idle "sitting" body art
// Idle-activity name (see main.js's IDLE_ACTIVITIES) -> pose key.
const IDLE_POSE_KEYS = { resting: 'resting', sitting: 'sitting', 'playing-alone': 'playing' };

function bodyPath(poseKey) {
  return `assets/character/parts/body/${bodyType}/${poseKey}.png`;
}

let store = null;
let pos = { x: 50, y: 55 };
let target = null;
let onArrive = null;
let rafId = null;
let decorateMode = false;
let moveMode = false;
let carryingUid = null; // decorate-mode: the room-item currently "picked up" and following the cursor
let speedMult = 1;
let bodyType = 'regular';

function scaleForDepth(y) {
  return 0.62 + (0.48 * (y - MIN_Y)) / (MAX_Y - MIN_Y);
}

function paintPetAt(x, y) {
  petWrap.style.left = `${x}%`;
  petWrap.style.top = `${y}%`;
  const scale = scaleForDepth(y);
  petWrap.style.transform = `translate(-50%, -92%) scale(${scale.toFixed(3)})`;
}

function step() {
  if (!target) { rafId = null; return; }
  const dx = target.x - pos.x;
  const dy = target.y - pos.y;
  const dist = Math.hypot(dx, dy);
  const dt = 1 / 60;
  const moveAmt = BASE_SPEED_PCT_PER_SEC * speedMult * dt;

  if (dist <= moveAmt || dist < 0.5) {
    pos = { ...target };
    target = null;
    petWrap.classList.remove('walking');
  } else {
    pos.x += (dx / dist) * moveAmt;
    pos.y += (dy / dist) * moveAmt;
    petWrap.classList.toggle('facing-left', dx < -0.1);
    petWrap.classList.toggle('facing-right', dx > 0.1);
  }
  paintPetAt(pos.x, pos.y);

  if (target) {
    rafId = requestAnimationFrame(step);
  } else {
    rafId = null;
    store.state.walk = { x: pos.x, y: pos.y };
    store.persist();
    const cb = onArrive;
    onArrive = null;
    if (cb) cb();
  }
}

// callback fires once the pet reaches (xPct,yPct); used by the AI to eat /
// pick things up on arrival instead of instantly.
export function walkPetTo(xPct, yPct, callback = null) {
  if (store.state.isSleeping) return;
  target = {
    x: Math.max(MIN_X, Math.min(MAX_X, xPct)),
    y: Math.max(MIN_Y, Math.min(MAX_Y, yPct)),
  };
  onArrive = callback;
  setIdlePose(null);
  petWrap.classList.add('walking');
  if (!rafId) rafId = requestAnimationFrame(step);
}

export function isPetWalking() {
  return !!target;
}

// Cancels any in-progress walk immediately — used when a petting hold
// session starts, since the pet holds still while being petted.
export function stopWalking() {
  target = null;
  onArrive = null;
  petWrap.classList.remove('walking');
}

// Toggles the petting-hold visuals: a slow squash-and-stretch on the
// character plus a hand bobbing over its head (see the .petting rules in
// css/style.css) — driven by main.js's startPetting()/endPetting().
export function setPettingVisual(isPetting) {
  petWrap.classList.toggle('petting', isPetting);
}

// Swaps to a dedicated face while being petted — pass 'gentle' when a hold
// starts, 'tooMuch' once it's gone on too long, or null to clear it back
// to the pet's normal emotion face (see refreshVisual() above for exactly
// which face each phase shows, and startPetting()/pettingLoop()/
// endPetting()/overpetted() in main.js for when each phase fires). Kept
// separate from setPettingVisual() since the bounce animation is a simple
// on/off but the face needs its own two-stage progression.
export function setPettingFace(phase) {
  pettingPhase = phase;
  refreshVisual();
}

export function getPetPosition() {
  return { ...pos };
}

export function bumpPet() {
  petVisual.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }],
    { duration: 260, easing: 'ease-out' }
  );
}

export function showHeartParticle() {
  const el = document.createElement('div');
  el.className = 'heart-particle';
  el.textContent = ['💗', '💕', '✨'][Math.floor(Math.random() * 3)];
  el.style.left = `${45 + Math.random() * 10}%`;
  petWrap.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

// Floats a "+X" coin amount up from above the character's head — same
// float-up-and-fade treatment as showHeartParticle(), just its own text
// and color instead of an emoji (see doScoldInteraction() in main.js).
export function showMoneyParticle(amount) {
  const el = document.createElement('div');
  el.className = 'money-particle';
  el.textContent = `+${amount} 🪙`;
  el.style.left = `${45 + Math.random() * 10}%`;
  petWrap.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

// ---- pet face/body art: sleeping overrides everything; tripping overrides
// everything except sleeping (it can't happen while asleep — see main.js);
// otherwise a petting-hold face (see setPettingFace()) overrides the mad
// face, which overrides the emotion's face, and an idle pose's body
// overrides the emotion's body. Every toggle (setSleepingVisual,
// setTripPhase, setPettingFace, setIdlePose, setEmotionVisual,
// setMadVisual) funnels through refreshVisual() so whichever is most
// specific always wins without them fighting over layerFace/layerBody. ----
let currentEmotion = 'happy';
let sleepingNow = false;
let madNow = false;
let loveFaceActive = false; // see setLoveFaceVisual()
let activePose = null; // 'resting' | 'sitting' | 'playing-alone' | null
let tantrumActive = false;
let tripPhase = null; // 'falling' | 'sitting' | null — see setTripPhase()
let pettingPhase = null; // 'gentle' | 'tooMuch' | null — see setPettingFace()

function refreshVisual() {
  // A tantrum flash (see playTantrum) is a brief, deliberate override —
  // don't let a persist()-triggered call from elsewhere (setSleepingVisual,
  // setEmotionVisual, etc. all run on every store.persist()) stomp on it
  // mid-animation. Whichever toggle changed still records its new value
  // above; refreshVisual() just runs for real once the flash ends.
  if (tantrumActive) return;
  if (sleepingNow) {
    layerFace.src = SLEEP_FACE;
    layerBody.src = bodyPath(SLEEP_POSE);
    return;
  }
  if (tripPhase) {
    layerFace.src = CRYING_FACE;
    layerBody.src = bodyPath(tripPhase === 'falling' ? TRIP_FALL_POSE : TRIP_SIT_POSE);
    return;
  }
  const { face, bodyPose } = emotionAssetPaths(currentEmotion);
  const pose = activePose ? IDLE_POSE_KEYS[activePose] : bodyPose;
  layerBody.src = bodyPath(pose);
  if (pettingPhase) {
    // Peaceful/eyes-closed at first, switching to the exhausted face once
    // the hold has gone on too long (see PET_METER_FILL_PER_SEC's 70%
    // "too much" threshold in main.js's pettingLoop()). Cleared back to
    // null the moment the hold ends, one way or another — see
    // endPetting()/overpetted() in main.js — so a failed hold falls
    // straight through to the mad face below instead of getting stuck.
    layerFace.src = pettingPhase === 'tooMuch' ? EXHAUSTED_FACE : SLEEP_FACE;
  } else {
    // The love face (happily watching a placed pet play — see
    // setLoveFaceVisual()) only ever overrides the face, not the body
    // pose, so it layers on top of whatever pose/emotion is already
    // showing.
    layerFace.src = loveFaceActive ? LOVE_FACE : (madNow ? MAD_FACE : face);
  }
}

// Toggles the heart-eyed "love" face — shown while happily watching a
// placed pet play (see playWithMonkey()'s high-love branch in main.js).
export function setLoveFaceVisual(on) {
  loveFaceActive = on;
  refreshVisual();
}

// Drives the trip sequence's visuals: 'falling' lays the character sideways
// (see the .tripped rule in css/style.css, which rotates #pet-visual — no
// separate lying-down redraw needed) with the flailing "tripped" body art;
// 'sitting' straightens back upright while swapping to the regular
// "sitting" body art, reading as sitting back up; null clears it back to
// normal. The crying face stays on through both phases. Timing (how long
// each phase lasts) is main.js's call — see triggerTrip() there.
export function setTripPhase(phase, dir = 1) {
  tripPhase = phase;
  petWrap.classList.toggle('tripped', phase === 'falling');
  if (phase === 'falling') petWrap.style.setProperty('--trip-dir', dir);
  refreshVisual();
}

// Sustained "mad" look (a while after being scolded, or after its sleep got
// interrupted) — just the face, so idle poses still read normally underneath
// it. See main.js for what triggers/clears this and playTantrum() below for
// the acute outburst.
export function setMadVisual(isMad) {
  madNow = isMad;
  refreshVisual();
}

// Brief flash of the tantrum pose (flailing/stomping) when a mad pet makes
// a mess, then reverts to whatever the normal pose/emotion body is.
export function playTantrum() {
  tantrumActive = true;
  layerBody.src = bodyPath(TANTRUM_POSE);
  petVisual.classList.add('tantrum-shake');
  setTimeout(() => {
    tantrumActive = false;
    petVisual.classList.remove('tantrum-shake');
    refreshVisual();
  }, 800);
}

// Quick recoil when scolded — turns sideways away from you, direction
// randomized, then springs back (see the .scold-flinch rule in
// css/style.css). Purely a transient CSS class on top of whatever face/body
// is already showing (the sustained "mad" face — see setMadVisual — is a
// separate toggle), so unlike playTantrum() there's no body/face art to
// protect from a mid-animation persist() call and no guard flag needed.
export function playScoldFlinch() {
  const dir = Math.random() < 0.5 ? 1 : -1;
  petVisual.style.setProperty('--scold-dir', dir);
  petVisual.classList.remove('scold-flinch');
  void petVisual.offsetWidth; // restart the animation if a previous flinch is still finishing
  petVisual.classList.add('scold-flinch');
  setTimeout(() => petVisual.classList.remove('scold-flinch'), 550);
}

// Whether a given room item is the one currently picked up in Decorate
// mode — main.js's monkey wander/banana-drop logic checks this before
// repositioning the monkey, so it doesn't fight the player over its
// position mid-drag (see monkeyTick() in js/main.js).
export function isBeingCarried(uid) {
  return uid === carryingUid;
}

// The two "playing with the monkey" reactions (see playWithMonkey() in
// js/main.js) — both are transient CSS classes on the monkey's own
// room-item element, found by uid since it's a plain <div> in the items
// layer, not a dedicated DOM ref like the character's own layers.
export function flashMonkeyFallen(uid) {
  const el = itemsLayer.querySelector(`.room-item[data-uid="${uid}"]`);
  if (!el) return;
  const dir = Math.random() < 0.5 ? 1 : -1;
  el.style.setProperty('--monkey-fall-dir', dir);
  el.classList.add('monkey-fallen');
  setTimeout(() => el.classList.remove('monkey-fallen'), 2000);
}
// ms lets a caller hold the slide for as long as its own reaction lasts
// (see the high-love branch of playWithMonkey() in main.js, which runs
// longer than this animation's own default) instead of the slide cutting
// out early and leaving the monkey frozen mid-reaction.
export function playMonkeySlide(uid, ms = 2200) {
  const el = itemsLayer.querySelector(`.room-item[data-uid="${uid}"]`);
  if (!el) return;
  el.classList.add('monkey-sliding');
  setTimeout(() => el.classList.remove('monkey-sliding'), ms);
}

// The character flops onto its side to watch a placed pet slide back and
// forth in front of it (see playWithMonkey()'s high-love branch in
// main.js) — the same rotate-the-sprite trick sleeping/tripping use (see
// the .watching-monkey rule in css/style.css), direction randomized per
// reaction via --watch-dir.
export function setWatchingMonkeyVisual(on) {
  if (on) petWrap.style.setProperty('--watch-dir', Math.random() < 0.5 ? 1 : -1);
  petWrap.classList.toggle('watching-monkey', on);
}

// Moves the monkey to a new spot smoothly instead of teleporting — updates
// the *existing* DOM element's left/top/font-size directly rather than
// going through the usual renderRoomItems() full rebuild. That distinction
// matters: renderRoomItems() tears down and recreates every room-item
// element from scratch, so a fresh element has no "before" position to
// transition from and the CSS transition on .monkey-decor (see
// css/style.css) would never actually get to animate — it'd just appear
// already at the destination. Also toggles the same two-frame walk-tilt
// wobble the character's own walk cycle uses, timed to match how long the
// move takes (see MONKEY_WALK_MS above).
export function moveMonkeyTo(item) {
  const el = itemsLayer.querySelector(`.room-item[data-uid="${item.uid}"]`);
  if (!el) return;
  el.classList.add('monkey-walking');
  // Force the browser to compute layout with whatever left/top this
  // element currently has *before* writing the new ones below. Without
  // this, if the element happened to be (re)created earlier in the very
  // same tick (e.g. monkeyTick() rebuilding the items layer for an
  // unrelated reason right before calling this), the browser can coalesce
  // both style writes into a single paint and skip the transition
  // entirely — the monkey would just pop straight to the new spot instead
  // of easing there, which reads as it randomly teleporting.
  void el.offsetWidth;
  el.style.left = `${item.x}%`;
  el.style.top = `${item.y}%`;
  el.style.fontSize = `${MONKEY_BASE_SIZE * scaleForDepth(item.y) * (item.scale || 1)}px`;
  setTimeout(() => el.classList.remove('monkey-walking'), MONKEY_WALK_MS);
}

// Character customization: "body" is really the outfit (regular/bikini/
// snow) — same body, different clothes — and affects every pose (see
// bodyPath() above); hair and ears are constant images regardless of
// mood/pose. All three are driven by state.equipped in state.js — see
// setCustomization().
export function setBodyType(type) {
  bodyType = type;
  refreshVisual();
}
export function setHairType(type) {
  layerHead.src = `assets/character/parts/head/${type}.png`;
}
export function setEarsType(type) {
  layerEars.src = `assets/character/parts/ears/${type}.png`;
}
// Which scenery the room is dressed in — see the [data-theme] rules in
// css/style.css. Doesn't touch anything placed in the room, just the
// wall/floor look.
export function setRoomTheme(type) {
  roomEl.dataset.theme = type;
}
// itemId looks like "body_regular" / "hair_curly" / "room_island" — the
// part after the first underscore is the type key used in file paths /
// theme names.
function typeFromItemId(itemId) {
  return itemId.slice(itemId.indexOf('_') + 1);
}
export function setCustomization(equipped) {
  setBodyType(typeFromItemId(equipped.body));
  setHairType(typeFromItemId(equipped.hair));
  setEarsType(typeFromItemId(equipped.ears));
  if (equipped.room) setRoomTheme(typeFromItemId(equipped.room));
}

const IDLE_POSE_CLASSES = ['resting', 'sitting', 'playing-alone'];
// Visual for the pet's self-directed idle behaviors (see main.js's
// idle-activity picker). Pass null to clear back to the normal stand.
export function setIdlePose(pose) {
  petWrap.classList.remove(...IDLE_POSE_CLASSES);
  if (pose) petWrap.classList.add(pose);
  activePose = pose;
  refreshVisual();
}

export function setSleepingVisual(isSleeping) {
  // store.persist() calls this on every save, including many times over
  // the course of one nap — only re-roll which side it's lying on at the
  // moment sleep actually *starts*, not on every redundant "still asleep"
  // call, or it'd flip sides every few seconds.
  const justFellAsleep = isSleeping && !sleepingNow;
  petWrap.classList.toggle('sleeping', isSleeping);
  sleepingNow = isSleeping;
  if (isSleeping) {
    target = null;
    onArrive = null;
    petWrap.classList.remove('walking');
    petWrap.classList.remove(...IDLE_POSE_CLASSES);
    activePose = null;
    if (justFellAsleep) petWrap.style.setProperty('--sleep-dir', Math.random() < 0.5 ? 1 : -1);
  }
  refreshVisual();
}

// Toggles the room's nighttime dimming overlay (see #room.night in
// css/style.css) — driven by isNight(state) in js/state.js via
// store.persist(), so it stays in sync with the same day/night clock that
// drives the actual sleep-decay change, purely cosmetic on its own.
export function setDayNightVisual(isNight) {
  roomEl.classList.toggle('night', isNight);
}

// Swaps the pet's face/body art to match its current dominant emotion, and
// applies that emotion's movement-speed penalty (if any). See emotions.js —
// this is the hook point for adding more emotion art later.
export function setEmotionVisual(emotionKey) {
  currentEmotion = emotionKey;
  speedMult = emotionEffect(emotionKey).moveMult || 1;
  refreshVisual();
}

// Shows/hides a small icon of whatever the pet is currently carrying —
// a glass of water while it drinks, or food on its way to a table (see
// goDrink()/goEat() in js/main.js).
export function setCarryingVisual(icon) {
  carrySlot.textContent = icon || '';
  petWrap.classList.toggle('carrying-item', !!icon);
}

export function renderPetName(state) {
  nameTag.textContent = state.petName;
}

function buildItemEl(item) {
  const icon = item.kind === 'mess' ? (MESS_ICONS[item.subtype] || MESS_ICONS.spill) : (ITEMS[item.itemId]?.icon || '❓');
  const el = document.createElement('div');
  const carrying = item.uid === carryingUid;
  // Pets (currently: the monkey and its beach/ice variants) render much
  // bigger than a decoration and get the walk-tilt/fallen/sliding
  // animations below — kept as its own `kind` rather than an itemId
  // check so any future pet item gets this for free.
  const isPet = item.kind === 'pet';
  el.className = `room-item kind-${item.kind}${carrying ? ' carrying' : ''}${isPet ? ' monkey-decor' : ''}`;
  el.innerHTML = renderIcon(icon);
  if (isPet) {
    // Override renderIcon()'s square 1em-by-1em box for just this image —
    // see MONKEY_HEIGHT_RATIO above.
    const img = el.querySelector('img');
    if (img) img.style.height = `${MONKEY_HEIGHT_RATIO}em`;
  }
  el.style.left = `${item.x}%`;
  el.style.top = `${item.y}%`;
  const base = isPet ? MONKEY_BASE_SIZE : (BASE_SIZE[item.kind] || 28);
  const resizable = item.kind === 'decoration';
  el.style.fontSize = `${base * scaleForDepth(item.y) * (resizable ? (item.scale || 1) : 1)}px`;
  el.dataset.uid = item.uid;
  if (item.kind === 'mess') {
    el.title = 'Click to clean up';
  } else if (carrying) {
    el.title = 'Click anywhere to place it there';
  } else if (item.kind === 'decoration') {
    const bonus = decorEffectDescription(item.itemId);
    const hint = decorateMode ? ' (click to pick up)' : '';
    el.title = `${ITEMS[item.itemId]?.name || ''}${bonus ? ' — ' + bonus : ''}${hint}`;
  } else if (decorateMode) {
    el.title = `${ITEMS[item.itemId]?.name || ''} (click to pick up)`;
  }
  // Only the one un-carried, resizable item under the pointer needs a
  // handle — hide all handles while something else is being carried so a
  // stray click can't start an unrelated resize mid-carry.
  if (resizable && decorateMode && !carryingUid) {
    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    handle.dataset.uid = item.uid;
    handle.title = 'Drag to resize';
    el.appendChild(handle);
  }
  return el;
}

export function renderRoomItems(state) {
  itemsLayer.innerHTML = '';
  for (const item of state.roomItems) {
    itemsLayer.appendChild(buildItemEl(item));
  }
}

// Adds a single new room item's element without rebuilding the rest of the
// layer — used when something new appears (e.g. a banana the monkey just
// dropped, see monkeyTick() in main.js) at a moment another item (the
// monkey itself) might be mid-animation. A full renderRoomItems() rebuild
// would recreate every element including that one, and doing so in the
// same tick as a moveMonkeyTo() call can eat its transition entirely (see
// moveMonkeyTo()'s comment above) — appending just the new element leaves
// everything else untouched.
export function appendRoomItem(item) {
  itemsLayer.appendChild(buildItemEl(item));
}

// Removes a single room item's element without rebuilding the rest of the
// layer — same reasoning as appendRoomItem() above, just for the opposite
// direction (e.g. cleaning up a mess, see the 'mess-clicked' handler in
// main.js). A full renderRoomItems() rebuild for a single removal would
// needlessly recreate every other mess too, restarting their
// `mess-wobble` animation (see .room-item.kind-mess in css/style.css) back
// in sync with each other, and could eat the monkey's own move transition
// the exact same way a rebuild always can (see moveMonkeyTo()'s comment).
export function removeRoomItem(uid) {
  const el = itemsLayer.querySelector(`.room-item[data-uid="${uid}"]`);
  if (el) el.remove();
}

export function setDecorateMode(on) {
  decorateMode = on;
  if (!on && carryingUid) {
    // leaving decorate mode mid-carry: just settle it where it is
    carryingUid = null;
    store.persist();
  }
  renderRoomItems(store.state);
  updateStorageButtonVisibility();
}

function updateStorageButtonVisibility() {
  storageBtn.classList.toggle('hidden', !carryingUid);
}

// Gates click-to-walk: the pet only follows a floor click when the player
// has Move mode active (see the sidebar's "Move" button in main.js).
// Autonomous walking (eating, drinking, wandering) calls walkPetTo()
// directly and is unaffected by this — it isn't "your" movement.
export function setMoveMode(on) {
  moveMode = on;
}

function floorPctFromEvent(e) {
  const rect = floorEl.getBoundingClientRect();
  const point = e.touches ? e.touches[0] : e;
  const x = ((point.clientX - rect.left) / rect.width) * 100;
  const y = ((point.clientY - rect.top) / rect.height) * 100;
  return { x, y };
}

function onFloorClick(e) {
  if (decorateMode) {
    if (carryingUid) dropCarried(floorPctFromEvent(e));
    return;
  }
  if (!moveMode) return;
  const { x, y } = floorPctFromEvent(e);
  walkPetTo(x, y);
}

// Raw pointer activity on the character — see the header comment for what
// main.js does with each of these.
function onPetPointerDown(e) {
  e.stopPropagation();
  window.dispatchEvent(new CustomEvent('pet-pressed'));
}
function onPetClick(e) {
  e.stopPropagation();
  window.dispatchEvent(new CustomEvent('pet-clicked'));
}

// Decorate-mode item placement is click-to-pick-up / click-to-drop, not a
// press-and-hold drag: click a room item once to pick it up (it then
// follows the pointer on plain mousemove, no button held), then click
// anywhere — the floor or another item — to place it there. Click the
// storage button instead to put it away. This avoids the old press-and-
// hold-drag model, which had no visual affordance telling the player to
// keep the button held down and could feel "stuck" once picked up.
//
// Resizing (the small handle on a decoration's corner) is still a genuine
// press-and-hold drag, tracked independently so it can't be confused with
// a pick-up/drop click; re-rendering the items layer mid-resize (needed for
// live feedback) would silently swallow a native 'click' on the handle
// afterward, so its own gesture is finalized on 'mouseup'/'touchend'
// instead of relying on 'click'.
let resizeUid = null;
let resizeCenter = null; // client-pixel center of the item being resized
let resizeStartDist = 1;
let resizeStartScale = 1;

function startResize(handle, e) {
  e.stopPropagation();
  const uid = handle.dataset.uid;
  const item = store.state.roomItems.find((d) => d.uid === uid);
  if (!item) return;
  const rect = handle.parentElement.getBoundingClientRect();
  resizeCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  const point = e.touches ? e.touches[0] : e;
  resizeStartDist = Math.max(1, Math.hypot(point.clientX - resizeCenter.x, point.clientY - resizeCenter.y));
  resizeStartScale = item.scale || 1;
  resizeUid = uid;
}

function startCarrying(uid) {
  carryingUid = uid;
  renderRoomItems(store.state);
  updateStorageButtonVisibility();
}

function dropCarried(pos) {
  const item = store.state.roomItems.find((d) => d.uid === carryingUid);
  carryingUid = null;
  if (item) {
    item.x = Math.max(4, Math.min(96, pos.x));
    item.y = Math.max(6, Math.min(96, pos.y));
    store.persist();
  }
  renderRoomItems(store.state);
  updateStorageButtonVisibility();
}

function putCarriedAway() {
  const item = store.state.roomItems.find((d) => d.uid === carryingUid);
  if (!item) { carryingUid = null; updateStorageButtonVisibility(); return; }
  store.state.roomItems = store.state.roomItems.filter((d) => d.uid !== carryingUid);
  carryingUid = null;
  store.persist();
  renderRoomItems(store.state);
  updateStorageButtonVisibility();
  window.dispatchEvent(new CustomEvent('room-item-removed', { detail: { item } }));
}

function onItemPointerDown(e) {
  const handle = e.target.closest('.resize-handle');
  if (handle) startResize(handle, e);
}

function onPointerMove(e) {
  if (resizeUid) {
    const point = e.touches ? e.touches[0] : e;
    const dist = Math.hypot(point.clientX - resizeCenter.x, point.clientY - resizeCenter.y);
    const item = store.state.roomItems.find((d) => d.uid === resizeUid);
    if (item) {
      item.scale = Math.max(MIN_DECOR_SCALE, Math.min(MAX_DECOR_SCALE, resizeStartScale * (dist / resizeStartDist)));
      // Resize the element in place instead of calling the full
      // renderRoomItems() rebuild on every move (that recreates the exact
      // element mid-gesture, which is its own can of worms — see the
      // pick-up/drop click history above). Also defer the actual style
      // write to the next frame rather than applying it synchronously in
      // this handler: applying it inline was found (via direct testing) to
      // occasionally swallow the drag's finishing mouseup entirely — the
      // resize would visually track the cursor but never actually get
      // saved, since onPointerUp's finalizer never ran. Batching the write
      // onto rAF avoids doing DOM work on every single high-frequency
      // mousemove tick and reliably sidesteps it.
      requestAnimationFrame(() => {
        const el = itemsLayer.querySelector(`.room-item[data-uid="${resizeUid}"]`);
        if (el) {
          const base = BASE_SIZE[item.kind] || 28;
          el.style.fontSize = `${base * scaleForDepth(item.y) * (item.scale || 1)}px`;
        }
      });
    }
    return;
  }
  if (carryingUid) {
    const { x, y } = floorPctFromEvent(e);
    const item = store.state.roomItems.find((d) => d.uid === carryingUid);
    if (item) {
      item.x = Math.max(4, Math.min(96, x));
      item.y = Math.max(6, Math.min(96, y));
      renderRoomItems(store.state);
    }
  }
}

function onPointerUp() {
  if (!resizeUid) return;
  resizeUid = null;
  resizeCenter = null;
  store.persist();
  renderRoomItems(store.state);
}

function onItemClick(e) {
  if (e.target.closest('.resize-handle')) return;
  const target = e.target.closest('.room-item');
  if (!target) return;
  const uid = target.dataset.uid;
  const item = store.state.roomItems.find((d) => d.uid === uid);
  if (!item) return;

  if (item.kind === 'mess') {
    window.dispatchEvent(new CustomEvent('mess-clicked', { detail: { uid } }));
    return;
  }
  if (!decorateMode) return;

  if (carryingUid) {
    // already carrying something else -> this click just places it here
    dropCarried(floorPctFromEvent(e));
    return;
  }
  startCarrying(uid);
}

export function initRoom(appStore) {
  store = appStore;
  pos = { x: store.state.walk.x, y: store.state.walk.y };
  paintPetAt(pos.x, pos.y);
  setCustomization(store.state.equipped);
  renderPetName(store.state);
  renderRoomItems(store.state);
  setSleepingVisual(store.state.isSleeping);

  floorEl.addEventListener('click', onFloorClick);
  petVisual.addEventListener('mousedown', onPetPointerDown);
  petVisual.addEventListener('touchstart', onPetPointerDown, { passive: true });
  petVisual.addEventListener('click', onPetClick);
  itemsLayer.addEventListener('mousedown', onItemPointerDown);
  itemsLayer.addEventListener('touchstart', onItemPointerDown, { passive: true });
  itemsLayer.addEventListener('click', onItemClick);
  storageBtn.addEventListener('click', putCarriedAway);
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('touchmove', onPointerMove, { passive: true });
  window.addEventListener('mouseup', onPointerUp);
  window.addEventListener('touchend', onPointerUp);
}
