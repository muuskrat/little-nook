// "Xinny Miku Dance" mini-game — DDR-style rhythm: arrows fall down 4 lanes
// toward a fixed receptor near the bottom of each; press the matching arrow
// key (or tap its receptor) right as it arrives. Timing is judged into three
// tiers — perfect, good, miss — with generous windows to keep it forgiving
// rather than punishing (same design philosophy as Flight to Japan's
// forgiving hitbox: a press that doesn't land a note is just ignored, not
// penalized). Self-contained: mounts into a container and reports coins
// earned via onEnd().
//
// Picking Easy/Medium/Hard (see DIFFICULTIES below) happens *inside* this
// module, as its own first screen, rather than index.js needing to know
// mini-games can have sub-choices — mount() still just gets called once by
// the generic Start button, same as every other game.
//
// Xinny herself dances along in whatever cosmetics are currently equipped
// (same body/hair/ears the main character and Flight to Japan's portrait
// use — see typeFromItemId()/bodyPath() below), reacting to how each note
// goes: any correct hit (perfect or good) swaps her into a random reaction
// pose — either the "playing" body pose, or the "tripped" pose facing left
// or right at random — while her face tells you *how well* it landed:
// neutral for a good hit, the sleeping face for a perfect one (she's so in
// the groove she's dozing through it). A miss switches her straight to the
// tantrum pose with a mad face. Whichever pose that leaves her in just
// sticks — no revert-to-idle timer — until the next note's judgment
// replaces it, so her stance always reflects how the *last* note actually
// went rather than snapping back to neutral between hits.

function typeFromItemId(itemId) {
  return itemId.slice(itemId.indexOf('_') + 1);
}

const FACE_DIR = 'assets/character/parts/face/';

function bodyPath(bodyType, poseKey) {
  return `assets/character/parts/body/${bodyType}/${poseKey}.png`;
}

const LANES = [
  { dir: 'left', key: 'ArrowLeft', glyph: '⬅️' },
  { dir: 'down', key: 'ArrowDown', glyph: '⬇️' },
  { dir: 'up', key: 'ArrowUp', glyph: '⬆️' },
  { dir: 'right', key: 'ArrowRight', glyph: '➡️' },
];

const LEAD_IN_MS = 1600;

// Everything that scales with difficulty in one place: how many notes, how
// fast they come and fall, how forgiving the timing windows are, how often
// the same lane can repeat back-to-back (`rerollChance` is the odds of
// re-rolling *away* from an accidental repeat — high on Easy so repeats
// basically never happen, low on Hard so back-to-back same-lane notes are
// common and have to be reacted to individually), and the payout per note.
const DIFFICULTIES = {
  easy: {
    label: 'Easy',
    blurb: 'Slower arrows, wide timing windows — a relaxed warm-up.',
    color: 'var(--sage)',
    noteCount: 14,
    intervalMs: 850,
    travelMs: 1900,
    perfectWindowMs: 110,
    goodWindowMs: 280,
    coinsPerfect: 2,
    coinsGood: 1,
    rerollChance: 0.92,
  },
  medium: {
    label: 'Medium',
    blurb: 'A steady beat with a fair bit of challenge.',
    color: 'var(--lavender)',
    noteCount: 18,
    intervalMs: 650,
    travelMs: 1500,
    perfectWindowMs: 70,
    goodWindowMs: 180,
    coinsPerfect: 3,
    coinsGood: 1,
    rerollChance: 0.7,
  },
  hard: {
    label: 'Hard',
    blurb: 'Fast arrows, tight timing, frequent repeats — pays the most.',
    color: 'var(--torii-red)',
    noteCount: 24,
    intervalMs: 480,
    travelMs: 1150,
    perfectWindowMs: 45,
    goodWindowMs: 120,
    coinsPerfect: 4,
    coinsGood: 2,
    rerollChance: 0.35,
  },
};

// A fixed-length chart rather than endless procedural notes, same "one
// bounded playthrough, then an end screen" shape every other mini-game here
// uses. `diff.rerollChance` controls how often a same-lane repeat is allowed
// to survive — see DIFFICULTIES above.
function buildChart(diff) {
  const chart = [];
  let t = LEAD_IN_MS;
  let lastDir = null;
  for (let i = 0; i < diff.noteCount; i++) {
    let dir;
    do { dir = LANES[Math.floor(Math.random() * LANES.length)].dir; } while (dir === lastDir && Math.random() < diff.rerollChance);
    lastDir = dir;
    chart.push({ dir, hitTime: t, judged: false, spawned: false, el: null });
    t += diff.intervalMs;
  }
  return chart;
}

export function mountDanceGame(container, { store, onEnd }) {
  const equipped = store.state.equipped;
  const bodyType = typeFromItemId(equipped.body);
  const hairType = typeFromItemId(equipped.hair);
  const earsType = typeFromItemId(equipped.ears);

  renderDifficultyPicker();

  function renderDifficultyPicker() {
    container.innerHTML = `
      <div class="dance-diff-picker">
        <p class="dance-diff-prompt">Choose a difficulty:</p>
        ${Object.entries(DIFFICULTIES).map(([key, d]) => `
          <button class="dance-diff-btn" data-diff="${key}" style="--diff-color: ${d.color};">
            <span class="dance-diff-name">${d.label}</span>
            <span class="dance-diff-desc">${d.blurb}</span>
          </button>`).join('')}
      </div>
    `;
    container.querySelectorAll('.dance-diff-btn').forEach((btn) => {
      btn.addEventListener('click', () => startRound(DIFFICULTIES[btn.dataset.diff]));
    });
  }

  function startRound(diff) {
    container.innerHTML = `
      <div class="game-hud">
        <span>💃 ${diff.label}</span>
        <span>🎤 Score: <span id="dance-score">0</span></span>
        <span>🔥 Combo: <span id="dance-combo">0</span></span>
      </div>
      <div class="game-stage dance-stage" id="dance-stage">
        <div class="dance-character-wrap">
          <div class="dance-character" id="dance-character">
            <img class="dance-layer dance-layer-body" id="dance-layer-body" alt="">
            <img class="dance-layer dance-layer-ears" src="assets/character/parts/ears/${earsType}.png" alt="">
            <img class="dance-layer dance-layer-head" src="assets/character/parts/head/${hairType}.png" alt="">
            <img class="dance-layer dance-layer-face" id="dance-layer-face" alt="">
          </div>
        </div>
        <div class="dance-lanes" id="dance-lanes">
          ${LANES.map((l) => `
            <div class="dance-lane" data-dir="${l.dir}">
              <div class="dance-receptor" data-dir="${l.dir}">${l.glyph}</div>
            </div>`).join('')}
        </div>
      </div>
      <p style="font-size:12px;color:var(--ink-soft);margin-top:6px;">Press the arrow keys (or tap the targets) right as the arrows arrive!</p>
    `;

    const stage = container.querySelector('#dance-stage');
    const charEl = container.querySelector('#dance-character');
    const charWrap = container.querySelector('.dance-character-wrap');
    const layerBody = container.querySelector('#dance-layer-body');
    const layerFace = container.querySelector('#dance-layer-face');
    const scoreEl = container.querySelector('#dance-score');
    const comboEl = container.querySelector('#dance-combo');

    const laneEls = {};
    const receptorEls = {};
    LANES.forEach((l) => {
      laneEls[l.dir] = container.querySelector(`.dance-lane[data-dir="${l.dir}"]`);
      receptorEls[l.dir] = container.querySelector(`.dance-receptor[data-dir="${l.dir}"]`);
    });

    function setIdle() {
      layerBody.src = bodyPath(bodyType, 'base');
      layerFace.src = `${FACE_DIR}face-neutral.png`;
      charEl.classList.remove('facing-left');
    }
    setIdle();

    let score = 0, combo = 0;
    let perfectCount = 0, goodCount = 0, missCount = 0;
    let running = true;
    let originTs = null;
    let rafId = null;
    const chart = buildChart(diff);

    function elapsedNow() {
      return originTs === null ? 0 : performance.now() - originTs;
    }

    function spawnJudgeLabel(text, color) {
      const label = document.createElement('div');
      label.className = 'dance-judge-label';
      label.style.color = color;
      label.textContent = text;
      charWrap.appendChild(label);
      label.addEventListener('animationend', () => label.remove());
    }

    // On a hit, which reaction body pose plays is random (playing, or
    // tripped facing either way) regardless of how well-timed the hit was —
    // only the *face* depends on that (see judgeHit()/judgeMiss() below).
    // Whichever pose this leaves her in just sticks — no revert-to-idle
    // timer — until the next note's judgment replaces it.
    function react(kind, judgment) {
      if (kind === 'miss') {
        layerBody.src = bodyPath(bodyType, 'tantrum');
        layerFace.src = `${FACE_DIR}face-mad.png`;
        charEl.classList.remove('facing-left');
      } else {
        const choice = Math.floor(Math.random() * 3);
        if (choice === 0) {
          layerBody.src = bodyPath(bodyType, 'playing');
          charEl.classList.remove('facing-left');
        } else {
          layerBody.src = bodyPath(bodyType, 'tripped');
          charEl.classList.toggle('facing-left', choice === 1);
        }
        layerFace.src = `${FACE_DIR}${judgment === 'perfect' ? 'face-sleeping' : 'face-neutral'}.png`;
      }
    }

    function flashReceptor(dir, cls) {
      const el = receptorEls[dir];
      el.classList.add(cls);
      setTimeout(() => el.classList.remove(cls), 220);
    }

    function judgeHit(note, timeDiff) {
      note.judged = true;
      if (note.el) { note.el.remove(); note.el = null; }
      combo++;
      comboEl.textContent = combo;
      if (Math.abs(timeDiff) <= diff.perfectWindowMs) {
        perfectCount++;
        score += diff.coinsPerfect;
        spawnJudgeLabel('PERFECT!', '#d19a1a');
        flashReceptor(note.dir, 'hit-perfect');
        react('hit', 'perfect');
      } else {
        goodCount++;
        score += diff.coinsGood;
        spawnJudgeLabel('Good!', '#2f7bd1');
        flashReceptor(note.dir, 'hit-good');
        react('hit', 'good');
      }
      scoreEl.textContent = score;
    }

    function judgeMiss(note) {
      note.judged = true;
      if (note.el) { note.el.remove(); note.el = null; }
      missCount++;
      combo = 0;
      comboEl.textContent = combo;
      spawnJudgeLabel('Miss...', '#b23a3a');
      flashReceptor(note.dir, 'hit-miss');
      react('miss');
    }

    // A press only ever resolves the single closest unjudged note in that
    // lane within goodWindowMs — a press that doesn't land one (wrong lane,
    // or nothing close enough yet) is simply ignored rather than punished.
    function tryHit(dir) {
      if (!running) return;
      let best = null, bestDiff = Infinity;
      for (const note of chart) {
        if (note.judged || note.dir !== dir) continue;
        const timeDiff = elapsedNow() - note.hitTime;
        if (Math.abs(timeDiff) <= diff.goodWindowMs && Math.abs(timeDiff) < bestDiff) {
          best = note;
          bestDiff = Math.abs(timeDiff);
        }
      }
      if (best) judgeHit(best, elapsedNow() - best.hitTime);
    }

    function onKey(e) {
      if (!running) return;
      const lane = LANES.find((l) => l.key === e.key);
      if (!lane) return;
      e.preventDefault();
      tryHit(lane.dir);
    }
    window.addEventListener('keydown', onKey);

    const receptorListeners = LANES.map((l) => {
      const el = receptorEls[l.dir];
      const onPointer = (e) => { e.preventDefault(); tryHit(l.dir); };
      el.addEventListener('mousedown', onPointer);
      el.addEventListener('touchstart', onPointer, { passive: false });
      return { el, onPointer };
    });

    function loop() {
      if (!running) return;
      if (originTs === null) originTs = performance.now();
      const elapsed = elapsedNow();

      let allDone = true;
      for (const note of chart) {
        if (note.judged) continue;
        allDone = false;
        const spawnTime = note.hitTime - diff.travelMs;
        if (!note.spawned && elapsed >= spawnTime) {
          note.spawned = true;
          const el = document.createElement('div');
          el.className = 'dance-note';
          el.textContent = LANES.find((l) => l.dir === note.dir).glyph;
          laneEls[note.dir].appendChild(el);
          note.el = el;
        }
        if (note.el) {
          const progress = Math.min(1.15, (elapsed - spawnTime) / diff.travelMs);
          const receptorY = laneEls[note.dir].clientHeight - 28; // matches .dance-receptor's `bottom: 20px` + half its own height
          note.el.style.top = `${progress * receptorY}px`;
        }
        if (elapsed > note.hitTime + diff.goodWindowMs) {
          judgeMiss(note);
        }
      }

      if (allDone) { endGame(); return; }
      rafId = requestAnimationFrame(loop);
    }

    function endGame() {
      if (!running) return;
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKey);
      receptorListeners.forEach(({ el, onPointer }) => {
        el.removeEventListener('mousedown', onPointer);
        el.removeEventListener('touchstart', onPointer);
      });
      chart.forEach((n) => { if (n.el) n.el.remove(); });

      const accuracy = (perfectCount + goodCount * 0.5) / diff.noteCount;
      const grade = accuracy >= 0.85 ? "You're a star! 🌟" : accuracy >= 0.5 ? 'Nice moves! 💃' : 'Keep practicing! 😅';

      const overlay = document.createElement('div');
      overlay.className = 'game-overlay-msg';
      overlay.innerHTML = `
        <div style="font-size:32px;">🎶</div>
        <div><strong>${grade}</strong></div>
        <div>${diff.label} • ${perfectCount} perfect • ${goodCount} good • ${missCount} miss</div>
        <div>You earned ${score} coins!</div>
        <button class="primary-btn" id="dance-collect">Collect</button>
      `;
      stage.appendChild(overlay);
      document.getElementById('dance-collect').addEventListener('click', () => onEnd(score));
    }

    rafId = requestAnimationFrame(loop);
  }
}
