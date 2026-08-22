// "Flight to Japan" mini-game (internally still keyed/named "flappy" in
// code — only the player-facing label, blurb, and in-game copy changed):
// classic flappy-bird clone. Click/tap/space to flap upward against
// gravity, thread the gaps between pipes, themed as torii gates on the way
// to Japan (see .flappy-pipe-part in css/style.css) — purely a visual/copy
// reskin, the actual gap/collision geometry is untouched. Self-contained:
// mounts into a container and reports coins earned via onEnd().
//
// The "bird" is actually a little round portrait of the player's own pet —
// its currently-equipped hair and ears layered over the plain neutral face
// (not whatever mood it's actually in right now; a calm expression reads
// better at this size and mid-flap than a random one would), reusing the
// exact same per-part art the main character itself is built from rather
// than a dedicated sprite. See buildBirdLayers() below for how the crop
// works.

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

// itemId looks like "hair_long" / "ears_bunny" — the part after the first
// underscore is the filename under assets/character/parts/<slot>/, same
// convention typeFromItemId() in js/room.js uses for the main character;
// duplicated here rather than exported/imported since it's a one-line
// helper and this game otherwise has no dependency on room.js.
function typeFromItemId(itemId) {
  return itemId.slice(itemId.indexOf('_') + 1);
}

// Ears, hair, and the plain neutral face, stacked in the same bottom-to-top
// order the main character's own layers use (ears under hair, face on top)
// — everything sharing the same 440x640 canvas as the character's other
// parts, so the *same* crop works for any hair/ears combo without needing
// per-asset tuning: each layer is shown at the container's own width with
// its native aspect ratio (`height: auto`), then the container's own
// `overflow: hidden` simply clips off whatever falls below it. Since the
// head, hair, and ears all sit within the top portion of that canvas
// (roughly the top two thirds) and a #flappy-bird-sized container is
// exactly as wide as the canvas scaled down, that clip line lands just
// below the hair/ears — no manual crop offset math needed.
// Wrapped in its own .flappy-bird-flip element (mirrored via CSS) rather
// than flipped here directly — see that class in css/style.css for why.
function buildBirdLayers(equipped) {
  const hairType = typeFromItemId(equipped.hair);
  const earsType = typeFromItemId(equipped.ears);
  return `
    <div class="flappy-bird-flip">
      <img class="flappy-bird-layer" src="assets/character/parts/ears/${earsType}.png" alt="">
      <img class="flappy-bird-layer" src="assets/character/parts/head/${hairType}.png" alt="">
      <img class="flappy-bird-layer" src="assets/character/parts/face/face-neutral.png" alt="">
    </div>
  `;
}

export function mountFlappyGame(container, { store, onEnd }) {
  container.innerHTML = `
    <div class="game-hud">
      <span>⛩️ Flight to Japan</span>
      <span>🪙 Score: <span id="flappy-score">0</span></span>
    </div>
    <div class="game-stage" id="flappy-stage">
      <div class="flappy-bird-sprite" id="flappy-bird">${buildBirdLayers(store.state.equipped)}</div>
    </div>
    <p style="font-size:12px;color:var(--ink-soft);margin-top:6px;">Click, tap, or press Space to flap. Avoid the gates!</p>
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
      <div style="font-size:32px;">⛩️</div>
      <div><strong>${score} gate${score === 1 ? '' : 's'} cleared!</strong></div>
      <div>You earned ${coins} coins!</div>
      <button class="primary-btn" id="flappy-collect">Collect</button>
    `;
    stage.appendChild(overlay);
    document.getElementById('flappy-collect').addEventListener('click', () => onEnd(coins));
  }

  rafId = requestAnimationFrame(loop);
}
