// "The Landlord" event: forced whack-a-mole triggered when rent comes due
// (see LANDLORD_EVERY_DAYS/LANDLORD_RENT in js/state.js) — not one of the
// player-chosen games in js/minigames/index.js. Five seconds to whack the
// landlord (he's the mole) as many times as you can; every hit wins back a
// slice of what he just took, capped at the total taken.

import { openModal, closeModal, showToast } from '../ui.js';

const GAME_MS = 5000;
const HOLE_COUNT = 6;
const MOLE_UP_MS = 700; // how long a mole stays poppable before ducking back down
const SPAWN_MIN_MS = 350;
const SPAWN_MAX_MS = 650;
const LANDLORD_FACE = '🤵';

// Mounts the actual game into `container` and calls onEnd(refundedAmount)
// exactly once, however it ends (time runs out, fully refunded, or the
// caller force-stops it early — see the returned controller). Doesn't know
// about coins/state at all; the caller applies the refund.
export function mountLandlordGame(container, amountTaken, onEnd) {
  const hitValue = Math.max(10, Math.round(amountTaken / 8));
  let refunded = 0;
  let running = true;
  let started = false; // true once Ready is clicked — see startReady() below
  let activeHole = -1;
  let spawnTimer = null;
  let hideTimer = null;
  let rafId = null;
  let startTs = 0;

  container.innerHTML = `
    <div class="game-hud">
      <span>⏱ <span id="landlord-time">${(GAME_MS / 1000).toFixed(1)}</span>s</span>
      <span>💰 <span id="landlord-refunded">0</span> / ${amountTaken}</span>
    </div>
    <div class="game-stage landlord-stage" id="landlord-stage">
      ${Array.from({ length: HOLE_COUNT }).map((_, i) => `
        <div class="landlord-hole" data-hole="${i}">
          <div class="landlord-mole">${LANDLORD_FACE}</div>
        </div>
      `).join('')}
      <div class="game-overlay-msg" id="landlord-ready-overlay">
        <div style="font-size:32px;">${LANDLORD_FACE}</div>
        <div><strong>Ready?</strong></div>
        <div>Whack him as many times as you can in ${(GAME_MS / 1000).toFixed(0)} seconds!</div>
        <button class="primary-btn" id="landlord-ready">Ready!</button>
      </div>
    </div>
    <p style="font-size:12px;color:var(--ink-soft);margin-top:6px;">Whack the landlord before he ducks back down!</p>
  `;

  const stage = container.querySelector('#landlord-stage');
  const timeEl = container.querySelector('#landlord-time');
  const refundedEl = container.querySelector('#landlord-refunded');
  const holes = [...container.querySelectorAll('.landlord-hole')];

  function popRandomMole() {
    if (!running) return;
    activeHole = Math.floor(Math.random() * HOLE_COUNT);
    holes[activeHole].classList.add('up');
    hideTimer = setTimeout(() => {
      if (activeHole >= 0) holes[activeHole].classList.remove('up');
      activeHole = -1;
      scheduleSpawn();
    }, MOLE_UP_MS);
  }

  function scheduleSpawn() {
    if (!running) return;
    const delay = SPAWN_MIN_MS + Math.random() * (SPAWN_MAX_MS - SPAWN_MIN_MS);
    spawnTimer = setTimeout(popRandomMole, delay);
  }

  function onHoleClick(e) {
    if (!running) return;
    const holeEl = e.target.closest('.landlord-hole');
    if (!holeEl) return;
    const idx = Number(holeEl.dataset.hole);
    if (idx !== activeHole) return; // whiffed — clicked an empty hole
    clearTimeout(hideTimer);
    holeEl.classList.remove('up');
    activeHole = -1;

    const gain = Math.min(hitValue, amountTaken - refunded);
    refunded += gain;
    refundedEl.textContent = refunded;

    const particle = document.createElement('div');
    particle.className = 'money-particle';
    particle.textContent = `+${gain}`;
    holeEl.appendChild(particle);
    particle.addEventListener('animationend', () => particle.remove());

    if (refunded >= amountTaken) { endGame(); return; }
    scheduleSpawn();
  }
  stage.addEventListener('click', onHoleClick);

  function tick(ts) {
    if (!running) return;
    const timeLeft = Math.max(0, GAME_MS - (ts - startTs));
    timeEl.textContent = (timeLeft / 1000).toFixed(1);
    if (timeLeft <= 0) { endGame(); return; }
    rafId = requestAnimationFrame(tick);
  }

  function stopTimers() {
    clearTimeout(spawnTimer);
    clearTimeout(hideTimer);
    if (rafId) cancelAnimationFrame(rafId);
  }

  // Natural end: time ran out or every coin got won back. Shows a Collect
  // overlay like the other mini-games rather than closing immediately.
  function endGame() {
    if (!running) return;
    running = false;
    stopTimers();
    stage.removeEventListener('click', onHoleClick);

    const gotItAll = refunded >= amountTaken;
    const overlay = document.createElement('div');
    overlay.className = 'game-overlay-msg';
    overlay.innerHTML = `
      <div style="font-size:32px;">${gotItAll ? '🪙✨' : '⏰'}</div>
      <div><strong>${gotItAll ? 'Got it all back!' : "Time's up!"}</strong></div>
      <div>You won back ${refunded} of the ${amountTaken} coins.</div>
      <button class="primary-btn" id="landlord-collect">Collect</button>
    `;
    stage.appendChild(overlay);
    document.getElementById('landlord-collect').addEventListener('click', () => onEnd(refunded));
  }

  // Abnormal end: the modal got closed (✕ / overlay click) mid-game — no
  // overlay to show (the container's about to be wiped by closeModal()),
  // just stop and report whatever was already won back.
  function forceStop() {
    if (!running) return;
    running = false;
    stopTimers();
    onEnd(refunded);
  }

  // The timer/spawning only actually starts once Ready is clicked — before
  // that the moles just sit there and the clock shows the full duration
  // (see tick()'s use of startTs, only set here).
  document.getElementById('landlord-ready').addEventListener('click', () => {
    if (started || !running) return;
    started = true;
    document.getElementById('landlord-ready-overlay')?.remove();
    startTs = performance.now();
    scheduleSpawn();
    rafId = requestAnimationFrame(tick);
  });

  return { forceStop };
}

// Opens the forced event modal and wires the game up to real coins/state —
// called from main.js the moment a live tick discovers rent came due (see
// _landlordTaken in state.js's applyDecay()).
export function openLandlordEvent(store, amountTaken) {
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <h2>🏚️ Rent's Due!</h2>
    <p>The landlord let himself in and took <strong>${amountTaken} coins</strong>. Whack him before he leaves — every hit wins some back!</p>
    <div id="landlord-area"></div>
  `;

  let controller = null;
  openModal(wrap, {
    onClose: () => controller?.forceStop(),
  });

  const area = wrap.querySelector('#landlord-area');
  controller = mountLandlordGame(area, amountTaken, (refunded) => {
    store.state.money += refunded;
    store.state.cyclePaused = false;
    store.persist();
    closeModal();
    showToast(refunded > 0 ? `Won back ${refunded} coins from the landlord!` : 'The landlord got away with it this time...');
  });
}
