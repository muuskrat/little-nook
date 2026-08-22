// Play modal: lets the player pick a mini-game, plays it, and pays out
// coins (and, for games that award more than coins, other rewards — see
// roulette.js). A game can have a cooldown before it can be played again,
// tracked as a timestamp in state.minigameCooldowns so it survives closing
// the modal or reloading the page — for now only Lucky Spin has one
// (cooldownMs: 0/undefined means "no cooldown," see cooldownRemaining()).

import { openModal, showToast, renderIcon } from '../ui.js';
import { clamp } from '../state.js';
import { mountCatchGame } from './catch.js';
import { mountMemoryGame } from './memory.js';
import { mountRouletteGame } from './roulette.js';
import { mountFlappyGame } from './flappy.js';
import { mountShoeSniffGame } from './shoesniff.js';
import { mountPeelBananaGame } from './peel.js';

const ROULETTE_COOLDOWN_MS = 3 * 60 * 1000;

// Playing takes real effort, regardless of which game or how it goes — a
// flat cost applied once per session, the moment a game actually starts
// (not per-attempt within it), shared by every game here rather than each
// one having to remember to charge it itself.
const MINIGAME_SLEEP_COST = 6;
const MINIGAME_LOVE_COST = 3;
const MINIGAME_FOOD_COST = 6;

const GAMES = [
  { key: 'catch', icon: '🧺', label: 'Snack Catch', blurb: 'Catch falling snacks for 30 seconds. Avoid rocks & socks!', mount: mountCatchGame },
  { key: 'memory', icon: '🧩', label: 'Match & Match', blurb: 'Flip cards to find matching pairs in as few moves as possible.', mount: mountMemoryGame },
  { key: 'roulette', icon: 'assets/icons/minigames/roulette-wheel.png', label: 'Lucky Spin', blurb: 'One spin — win food, a drink, or coins, and rarely the jackpot: a free cosmetic or decoration!', mount: mountRouletteGame, cooldownMs: ROULETTE_COOLDOWN_MS },
  { key: 'flappy', icon: 'assets/icons/minigames/flappy-bird.png', label: 'Flap Flap', blurb: 'Flap through the gaps between pipes without crashing.', mount: mountFlappyGame },
  { key: 'sniff', icon: 'assets/icons/minigames/stinky-shoe.png', label: 'Sneaky Sniff', blurb: "Sniff the stinky shoe — but only when you're not being watched!", mount: mountShoeSniffGame },
  { key: 'peel', icon: 'assets/icons/minigames/peel-banana-whole.svg', label: 'Peel Banana', blurb: 'Peel all 3 sections — no rush. How browned it turns out to be decides its rarity and payout.', mount: mountPeelBananaGame },
];

export function openPlayMenu(store) {
  let activeGame = GAMES[0].key;
  let countdownId = null;

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <h2>🎮 Mini-games</h2>
    <div class="tab-row" id="play-tabs">
      ${GAMES.map((g) => `<button class="tab-btn ${g.key === activeGame ? 'active' : ''}" data-tab="${g.key}">${renderIcon(g.icon)} ${g.label}</button>`).join('')}
    </div>
    <div id="play-area"></div>
  `;
  openModal(wrap);

  function cooldownRemaining(gameKey) {
    const until = store.state.minigameCooldowns?.[gameKey] || 0;
    return Math.max(0, until - Date.now());
  }

  function renderIntro(gameKey) {
    clearInterval(countdownId);
    const game = GAMES.find((g) => g.key === gameKey);
    const area = document.getElementById('play-area');
    const remaining = cooldownRemaining(gameKey);

    if (remaining > 0) {
      area.innerHTML = `
        <p>${game.blurb}</p>
        <p class="cooldown-msg">⏳ Play again in <span id="cooldown-secs">${Math.ceil(remaining / 1000)}</span>s</p>
        <button class="primary-btn" id="play-start" disabled>Start</button>
      `;
      countdownId = setInterval(() => {
        const secsEl = document.getElementById('cooldown-secs');
        if (!secsEl) { clearInterval(countdownId); return; } // modal closed or tab switched away
        const left = cooldownRemaining(gameKey);
        if (left <= 0) { clearInterval(countdownId); renderIntro(gameKey); return; }
        secsEl.textContent = Math.ceil(left / 1000);
      }, 250);
      return;
    }

    area.innerHTML = `
      <p>${game.blurb}</p>
      <button class="primary-btn" id="play-start">Start</button>
    `;
    document.getElementById('play-start').addEventListener('click', () => startGame(gameKey));
  }

  function startGame(gameKey) {
    const game = GAMES.find((g) => g.key === gameKey);
    const area = document.getElementById('play-area');
    area.innerHTML = '';
    area.style.position = 'relative';

    const { state } = store;
    state.stats.sleep = clamp(state.stats.sleep - MINIGAME_SLEEP_COST);
    state.stats.love = clamp(state.stats.love - MINIGAME_LOVE_COST);
    state.stats.food = clamp(state.stats.food - MINIGAME_FOOD_COST);
    store.persist();

    game.mount(area, {
      store,
      // `coins` is applied here so every game (old and new) shares the
      // same payout + cooldown plumbing; `message`, if given, replaces the
      // default toast — used by games like roulette that award something
      // other than (or in addition to) coins and want to say what.
      onEnd: (coins = 0, message = null) => {
        if (coins) store.state.money += coins;
        if (game.cooldownMs) store.state.minigameCooldowns[gameKey] = Date.now() + game.cooldownMs;
        store.persist();
        showToast(message || `+${coins} coins! 🪙`);
        renderIntro(gameKey);
      },
    });
  }

  document.getElementById('play-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    activeGame = btn.dataset.tab;
    document.querySelectorAll('#play-tabs .tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
    renderIntro(activeGame);
  });

  renderIntro(activeGame);
}
