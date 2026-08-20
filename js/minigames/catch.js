// "Snack Catch" mini-game: move the basket to catch falling good items for
// coins while avoiding bad ones. Self-contained: mounts into a container and
// reports coins earned via onEnd().

const GOOD = [
  { icon: '🍎', value: 1 },
  { icon: '🥪', value: 2 },
  { icon: '🍰', value: 3 },
  { icon: '💧', value: 1 },
  { icon: '🧃', value: 2 },
];
const BAD = [{ icon: '🪨', value: 0 }, { icon: '🧦', value: 0 }];
const GAME_SECONDS = 30;

export function mountCatchGame(container, { onEnd }) {
  container.innerHTML = `
    <div class="game-hud">
      <span>⏱ <span id="catch-time">${GAME_SECONDS}</span>s</span>
      <span id="catch-lives">❤️❤️❤️</span>
      <span>🪙 <span id="catch-score">0</span></span>
    </div>
    <div class="game-stage" id="catch-stage">
      <div id="basket">🧺</div>
    </div>
    <p style="font-size:12px;color:var(--ink-soft);margin-top:6px;">Move your mouse (or drag on mobile) to catch food. Avoid rocks &amp; socks!</p>
  `;

  const stage = container.querySelector('#catch-stage');
  const basket = container.querySelector('#basket');
  const timeEl = container.querySelector('#catch-time');
  const livesEl = container.querySelector('#catch-lives');
  const scoreEl = container.querySelector('#catch-score');

  let score = 0, lives = 3, timeLeft = GAME_SECONDS, running = true;
  let basketX = 50; // %
  let items = [];
  let spawnTimer = 0, spawnInterval = 850;
  let rafId = null, lastTs = null;

  basket.style.left = `${basketX}%`;

  function setBasketFromClientX(clientX) {
    const rect = stage.getBoundingClientRect();
    basketX = Math.max(6, Math.min(94, ((clientX - rect.left) / rect.width) * 100));
    basket.style.left = `${basketX}%`;
  }
  function onMove(e) {
    const p = e.touches ? e.touches[0] : e;
    setBasketFromClientX(p.clientX);
  }
  function onKey(e) {
    if (e.key === 'ArrowLeft') basketX = Math.max(6, basketX - 4);
    if (e.key === 'ArrowRight') basketX = Math.min(94, basketX + 4);
    basket.style.left = `${basketX}%`;
  }
  stage.addEventListener('mousemove', onMove);
  stage.addEventListener('touchmove', onMove, { passive: true });
  window.addEventListener('keydown', onKey);

  function spawnItem() {
    const isBad = Math.random() < 0.25;
    const pick = isBad ? BAD[Math.floor(Math.random() * BAD.length)] : GOOD[Math.floor(Math.random() * GOOD.length)];
    const el = document.createElement('div');
    el.className = 'falling-item';
    el.textContent = pick.icon;
    const x = 8 + Math.random() * 84;
    el.style.left = `${x}%`;
    el.style.top = '-20px';
    stage.appendChild(el);
    items.push({ el, x, y: -20, speed: 75 + Math.random() * 45 + (GAME_SECONDS - timeLeft) * 2.2, good: !isBad, value: pick.value });
  }

  function flash(color) {
    stage.animate([{ filter: 'brightness(1)' }, { filter: `brightness(${color})` }, { filter: 'brightness(1)' }], { duration: 220 });
  }

  function loop(ts) {
    if (!running) return;
    if (!lastTs) lastTs = ts;
    const dt = (ts - lastTs) / 1000;
    lastTs = ts;

    spawnTimer += dt * 1000;
    if (spawnTimer > spawnInterval) { spawnTimer = 0; spawnItem(); }

    const stageH = stage.clientHeight;
    const basketTop = stageH - 46;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.y += it.speed * dt;
      it.el.style.top = `${it.y}px`;
      if (it.y >= basketTop && it.y < basketTop + 30 && Math.abs(it.x - basketX) < 9) {
        if (it.good) { score += it.value; scoreEl.textContent = score; flash(1.25); }
        else { lives--; livesEl.textContent = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(3 - Math.max(0, lives)); flash(0.6); }
        it.el.remove();
        items.splice(i, 1);
        continue;
      }
      if (it.y > stageH + 20) { it.el.remove(); items.splice(i, 1); }
    }

    if (lives <= 0) { endGame(); return; }
    rafId = requestAnimationFrame(loop);
  }

  const countdownId = setInterval(() => {
    timeLeft--;
    timeEl.textContent = timeLeft;
    if (timeLeft <= 0) endGame();
  }, 1000);

  function endGame() {
    if (!running) return;
    running = false;
    clearInterval(countdownId);
    if (rafId) cancelAnimationFrame(rafId);
    stage.removeEventListener('mousemove', onMove);
    stage.removeEventListener('touchmove', onMove);
    window.removeEventListener('keydown', onKey);
    items.forEach((it) => it.el.remove());
    items = [];

    const overlay = document.createElement('div');
    overlay.className = 'game-overlay-msg';
    overlay.innerHTML = `
      <div style="font-size:32px;">🎉</div>
      <div><strong>You earned ${score} coins!</strong></div>
      <button class="primary-btn" id="catch-collect">Collect</button>
    `;
    stage.appendChild(overlay);
    document.getElementById('catch-collect').addEventListener('click', () => onEnd(score));
  }

  rafId = requestAnimationFrame(loop);
}
