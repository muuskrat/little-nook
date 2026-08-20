// "Flap Flap" mini-game: classic flappy-bird clone. Click/tap/space to
// flap upward against gravity, thread the gaps between pipes. Self-
// contained: mounts into a container and reports coins earned via onEnd().

const BIRD_X = 60;
const BIRD_SIZE = 34;
// Collision uses a smaller box than the visible sprite — the bird can
// visually overlap a pipe by a few px on either side without it counting
// as a hit, so a near-miss reads as "phew, made it" instead of feeling
// unfairly harsh for grazing a pipe. Applied to both the pipe hitbox and
// the ceiling/floor check, same margin either way.
const HIT_MARGIN = 6;
const GRAVITY = 1000; // px/s^2
const FLAP_VELOCITY = -320; // px/s, instantaneous upward kick
const PIPE_SPEED = 130; // px/s leftward
const PIPE_GAP = 140; // px, vertical opening the bird flies through
const PIPE_WIDTH = 52;
const PIPE_INTERVAL_MS = 1400;
const COINS_PER_PIPE = 3;

export function mountFlappyGame(container, { onEnd }) {
  container.innerHTML = `
    <div class="game-hud">
      <span>🐦 Flap Flap</span>
      <span>🪙 Score: <span id="flappy-score">0</span></span>
    </div>
    <div class="game-stage" id="flappy-stage">
      <img class="flappy-bird-sprite" id="flappy-bird" src="assets/icons/minigames/flappy-bird.png" alt="">
    </div>
    <p style="font-size:12px;color:var(--ink-soft);margin-top:6px;">Click, tap, or press Space to flap. Avoid the pipes!</p>
  `;

  const stage = container.querySelector('#flappy-stage');
  const bird = container.querySelector('#flappy-bird');
  const scoreEl = container.querySelector('#flappy-score');

  let birdY = 150;
  let vel = 0;
  let pipes = [];
  let score = 0;
  let running = true;
  let spawnTimer = 0;
  let rafId = null, lastTs = null;

  bird.style.left = `${BIRD_X}px`;

  function flap() {
    if (!running) return;
    vel = FLAP_VELOCITY;
  }
  function onPointer(e) { e.preventDefault(); flap(); }
  function onKey(e) { if (e.code === 'Space') { e.preventDefault(); flap(); } }
  stage.addEventListener('mousedown', onPointer);
  stage.addEventListener('touchstart', onPointer, { passive: false });
  window.addEventListener('keydown', onKey);

  function spawnPipe() {
    const stageH = stage.clientHeight;
    const gapCenter = 55 + Math.random() * Math.max(10, stageH - 110);
    const el = document.createElement('div');
    el.className = 'flappy-pipe';
    const topEl = document.createElement('div');
    topEl.className = 'flappy-pipe-part flappy-pipe-top';
    const bottomEl = document.createElement('div');
    bottomEl.className = 'flappy-pipe-part flappy-pipe-bottom';
    el.appendChild(topEl);
    el.appendChild(bottomEl);
    stage.appendChild(el);
    pipes.push({ el, topEl, bottomEl, x: stage.clientWidth, gapCenter, passed: false });
  }

  function layoutPipe(p) {
    const stageH = stage.clientHeight;
    p.el.style.left = `${p.x}px`;
    p.el.style.width = `${PIPE_WIDTH}px`;
    p.topEl.style.height = `${Math.max(0, p.gapCenter - PIPE_GAP / 2)}px`;
    p.bottomEl.style.top = `${p.gapCenter + PIPE_GAP / 2}px`;
    p.bottomEl.style.height = `${Math.max(0, stageH - (p.gapCenter + PIPE_GAP / 2))}px`;
  }

  function loop(ts) {
    if (!running) return;
    if (!lastTs) lastTs = ts;
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;

    vel += GRAVITY * dt;
    birdY += vel * dt;
    bird.style.top = `${birdY}px`;
    bird.style.transform = `translateY(-50%) rotate(${Math.max(-25, Math.min(75, vel / 8))}deg)`;

    spawnTimer += dt * 1000;
    if (spawnTimer > PIPE_INTERVAL_MS) { spawnTimer = 0; spawnPipe(); }

    const stageH = stage.clientHeight;
    const hitHalf = BIRD_SIZE / 2 - HIT_MARGIN;
    let hit = birdY - hitHalf <= 0 || birdY + hitHalf >= stageH;

    for (let i = pipes.length - 1; i >= 0; i--) {
      const p = pipes[i];
      p.x -= PIPE_SPEED * dt;
      layoutPipe(p);

      if (!p.passed && p.x + PIPE_WIDTH < BIRD_X) {
        p.passed = true;
        score++;
        scoreEl.textContent = score;
      }

      const overlapsX = BIRD_X + hitHalf > p.x && BIRD_X - hitHalf < p.x + PIPE_WIDTH;
      if (overlapsX) {
        const inGap = birdY - hitHalf > p.gapCenter - PIPE_GAP / 2 && birdY + hitHalf < p.gapCenter + PIPE_GAP / 2;
        if (!inGap) hit = true;
      }

      if (p.x + PIPE_WIDTH < -10) { p.el.remove(); pipes.splice(i, 1); }
    }

    if (hit) { endGame(); return; }
    rafId = requestAnimationFrame(loop);
  }

  function endGame() {
    if (!running) return;
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    stage.removeEventListener('mousedown', onPointer);
    stage.removeEventListener('touchstart', onPointer);
    window.removeEventListener('keydown', onKey);
    pipes.forEach((p) => p.el.remove());
    pipes = [];

    const coins = score * COINS_PER_PIPE;
    const overlay = document.createElement('div');
    overlay.className = 'game-overlay-msg';
    overlay.innerHTML = `
      <div style="font-size:32px;">🐦</div>
      <div><strong>${score} pipe${score === 1 ? '' : 's'} cleared!</strong></div>
      <div>You earned ${coins} coins!</div>
      <button class="primary-btn" id="flappy-collect">Collect</button>
    `;
    stage.appendChild(overlay);
    document.getElementById('flappy-collect').addEventListener('click', () => onEnd(coins));
  }

  rafId = requestAnimationFrame(loop);
}
