// "Peel Banana" mini-game: the banana is drawn as a thin body tapering to a
// rounded point at both the top and bottom (see assets/icons/minigames/
// peel-banana-whole.svg), split into 3 equal VERTICAL thirds — left,
// middle, right, like the 3 strips a real banana peel splits into
// lengthwise — click each one individually to peel that specific strip,
// revealing the banana underneath it right there rather than a single
// continuous reveal. No timer, no losing condition; win just by peeling
// all 3. Self-contained: mounts into a container and reports coins earned
// via onEnd().
//
// The twist: every banana secretly rolls its own amount of browning/bruising
// per section (0-100) before you ever click — invisible until you actually
// peel that section, at which point it shows up two ways at once: a CSS
// sepia tint scaled to that section's own severity, and an immediate
// floating verdict for just that section, using the *same* Crap-through-
// Legendary tier names/colors the overall rarity uses (see QUALITY_TIERS —
// one shared table for both, keyed by *freshness*, i.e. 100 minus
// brownness). Fresher is better: a section (or the banana overall) with low
// brownness reads as a high tier, a heavily browned one reads as low.
// Freshness itself is the rare roll (see rollBrownness() — skewed toward
// heavy browning), so genuinely pristine sections/bananas stay special
// rather than being the everyday case, and Legendary stays rare rather
// than the common outcome the naive "just flip the labels" version would
// have made it.
//
// A section that comes up Epic or Legendary also gets a soft colored glow
// (baked into that section's own filter, see buildBrownFilter()'s `glow`
// param) — a little for Epic, more for Legendary — so a great roll reads
// as visibly special the moment it's revealed, not just via its text label.
//
// The banana's overall rarity/payout is a blend of its average freshness
// and its single *best* section's freshness (see endGame()'s
// effectiveFreshness) rather than a flat average — a flat average let a
// genuinely great individual peel (the exciting per-section verdict above)
// get quietly buried by two mediocre ones, so landing a Legendary or Epic
// section felt like flavor text disconnected from the actual payout.
// Blending in the best section means one great peel visibly pulls the
// overall tier up, while the average half still keeps three-great-sections
// worth more than one lucky one.
//
// Built from the same two layered images each time — full copies of both
// the whole banana and the peeled banana, each split into 3 independently
// clickable vertical strips via clip-path: inset(0 right% 0 left%)
// (computed per section in JS). clip-path clips hit-testing along with
// rendering, so each section is only clickable within its own visible
// strip, with no extra hit-target elements needed — the one wrinkle is
// that clip-path doesn't change an element's actual bounding box, only
// what's paintable/hit-testable *within* it, so all 3 sections still
// report an identical (full-banana-sized) bounding box; a click has to
// land somewhere inside a section's own visible strip specifically, which
// is naturally how a real click on the visible art already works.

const PEEL_SECTIONS = 3;
const BROWN_MIN = 0;
const BROWN_MAX = 100;

// Shared by both the per-section floating verdict and the overall end-of-
// game rarity — ordered low-to-high; `max` is the top (inclusive) of this
// tier's *freshness* range (100 - brownness), and `coins` is the [min,max]
// payout rolled once the banana's fully peeled (only used for the overall
// tier, not the per-section one). Whichever tier's `max` a given freshness
// value first falls at-or-under is the one that applies.
const QUALITY_TIERS = [
  { key: 'crap', label: 'Crap', color: '#8a8a8a', max: 14, coins: [1, 3] },
  { key: 'common', label: 'Common', color: '#4A4038', max: 34, coins: [3, 6] },
  { key: 'rare', label: 'Rare', color: '#2f7bd1', max: 59, coins: [6, 10] },
  { key: 'epic', label: 'Epic', color: '#9b3fd1', max: 79, coins: [10, 16] },
  { key: 'legendary', label: 'Legendary', color: '#d19a1a', max: 100, coins: [16, 25] },
];

function tierForFreshness(freshness) {
  return QUALITY_TIERS.find((t) => freshness <= t.max) || QUALITY_TIERS[QUALITY_TIERS.length - 1];
}

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// Skewed toward HIGH values (squaring a uniform [0,1) roll skews toward 0,
// so subtracting that from BROWN_MAX skews the result toward BROWN_MAX
// instead) — most sections come up at least somewhat browned, so a
// section (or a whole banana) staying genuinely fresh is the rare, special
// case, matching Legendary actually being rare rather than the everyday
// outcome.
function rollBrownness() {
  return BROWN_MAX - Math.pow(Math.random(), 2) * (BROWN_MAX - BROWN_MIN);
}

// 0 brownness reads as the peeled banana's normal pale color unchanged;
// 100 pushes it toward a deeply browned/bruised look. `glow`, if given
// ('epic' | 'legendary'), adds a soft colored halo around that section's
// own silhouette — a little for Epic, more for Legendary — via extra
// drop-shadow layers rather than a separate CSS class, since setting
// `filter` inline (needed for the sepia amount) replaces any class rule's
// value entirely rather than adding to it; the base drop-shadow the generic
// `.peel-banana-wrap img` CSS rule applies to every other layer is folded
// in here for the same reason.
function buildBrownFilter(amt, glow) {
  const t = amt / 100;
  let filter = `sepia(${t.toFixed(2)}) saturate(${(1 + t * 0.4).toFixed(2)}) brightness(${(1 - t * 0.28).toFixed(2)}) drop-shadow(0 4px 4px rgba(0,0,0,0.2))`;
  if (glow === 'legendary') {
    filter += ' drop-shadow(0 0 4px rgba(209,154,26,0.95)) drop-shadow(0 0 10px rgba(209,154,26,0.7))';
  } else if (glow === 'epic') {
    filter += ' drop-shadow(0 0 4px rgba(155,63,209,0.65))';
  }
  return filter;
}

export function mountPeelBananaGame(container, { onEnd }) {
  // Rolled once per playthrough, before a single click happens — the
  // banana's fate (and its rarity) is already sealed, just not visible yet.
  const brownness = Array.from({ length: PEEL_SECTIONS }, rollBrownness);
  const sectionTiers = brownness.map((b) => tierForFreshness(100 - b));

  const sectionsHtml = Array.from({ length: PEEL_SECTIONS }, (_, i) => {
    const leftPct = (i / PEEL_SECTIONS) * 100;
    const rightPct = 100 - ((i + 1) / PEEL_SECTIONS) * 100;
    const clip = `clip-path: inset(0 ${rightPct}% 0 ${leftPct}%);`;
    const glow = sectionTiers[i].key === 'epic' || sectionTiers[i].key === 'legendary' ? sectionTiers[i].key : null;
    return `
      <div class="peel-flesh-section" style="${clip}">
        <img src="assets/icons/minigames/peel-banana-peeled.svg" style="filter: ${buildBrownFilter(brownness[i], glow)};" alt="">
      </div>
      <div class="peel-section" data-section="${i}" style="${clip}">
        <img src="assets/icons/minigames/peel-banana-whole.svg" alt="">
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="game-hud">
      <span>🍌 Peeled: <span id="peel-count">0</span>/${PEEL_SECTIONS}</span>
    </div>
    <div class="game-stage peel-stage" id="peel-stage">
      <div class="peel-banana-wrap" id="peel-banana">
        ${sectionsHtml}
      </div>
    </div>
    <p style="font-size:12px;color:var(--ink-soft);margin-top:6px;">Click each section of the banana to peel it! No rush — take your time.</p>
  `;

  const stage = container.querySelector('#peel-stage');
  const bananaWrap = container.querySelector('#peel-banana');
  const sections = Array.from(container.querySelectorAll('.peel-section'));
  const countEl = container.querySelector('#peel-count');

  let peeledCount = 0;
  let running = true;

  // A little strip flies off from the clicked section toward a random
  // direction, for juice — a plain colored chip rather than another asset,
  // since it's on screen for barely half a second. Originates from that
  // section's own horizontal center (left/middle/right third), not always
  // the banana's own center, since the sections are vertical strips now.
  function spawnPeelBit(originXPct) {
    const bit = document.createElement('div');
    bit.className = 'peel-strip-bit';
    bit.style.left = `${originXPct}%`;
    const angle = -90 + (Math.random() * 140 - 70); // mostly upward, some spread
    const dist = 40 + Math.random() * 18;
    bit.style.setProperty('--peel-dx', `${Math.cos((angle * Math.PI) / 180) * dist}px`);
    bit.style.setProperty('--peel-dy', `${Math.sin((angle * Math.PI) / 180) * dist}px`);
    bit.style.setProperty('--peel-rot', `${Math.random() * 360 - 180}deg`);
    bananaWrap.appendChild(bit);
    bit.addEventListener('animationend', () => bit.remove());
  }

  // Floats a short-lived "Crap"/"Rare"/"Legendary" verdict up from the
  // section that was just peeled, color-coded by tier — see
  // QUALITY_TIERS/tierForFreshness() above. This is the section's own
  // reading, separate from (and not necessarily matching) the overall
  // rarity you only find out once all 3 are peeled.
  function spawnQualityLabel(originXPct, tier) {
    const label = document.createElement('div');
    label.className = 'peel-quality-label';
    label.style.left = `${originXPct}%`;
    label.style.color = tier.color;
    label.textContent = tier.label;
    bananaWrap.appendChild(label);
    label.addEventListener('animationend', () => label.remove());
  }

  function onSectionClick(e) {
    if (!running) return;
    const el = e.currentTarget;
    if (el.classList.contains('peeled')) return;
    el.classList.add('peeled');
    peeledCount++;
    countEl.textContent = peeledCount;

    const i = Number(el.dataset.section);
    // Peels off sideways, away from the banana's center — the left third
    // slides left, the right third slides right, matching how a real peel
    // strip would fall away from whichever side it's pulled from.
    const dir = i - (PEEL_SECTIONS - 1) / 2;
    el.style.setProperty('--peel-out-x', `${dir * 22}px`);
    el.style.setProperty('--peel-out-rot', `${dir * 18}deg`);
    const centerXPct = ((i + 0.5) / PEEL_SECTIONS) * 100;
    spawnPeelBit(centerXPct);
    spawnQualityLabel(centerXPct, sectionTiers[i]);
    bananaWrap.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.1)' }, { transform: 'scale(1)' }],
      { duration: 200, easing: 'ease-out' }
    );

    if (peeledCount >= PEEL_SECTIONS) endGame();
  }
  sections.forEach((el) => el.addEventListener('click', onSectionClick));

  function endGame() {
    if (!running) return;
    running = false;
    sections.forEach((el) => el.removeEventListener('click', onSectionClick));

    const freshnessValues = brownness.map((b) => 100 - b);
    const avgFreshness = freshnessValues.reduce((a, b) => a + b, 0) / PEEL_SECTIONS;
    const bestFreshness = Math.max(...freshnessValues);
    // Half average, half your single best section — see the file header
    // for why a flat average alone made a great individual peel feel
    // pointless.
    const effectiveFreshness = (avgFreshness + bestFreshness) / 2;
    const tier = tierForFreshness(effectiveFreshness);
    const coins = randInt(tier.coins[0], tier.coins[1]);

    const overlay = document.createElement('div');
    overlay.className = 'game-overlay-msg';
    overlay.innerHTML = `
      <div style="font-size:32px;">🍌</div>
      <div><strong style="color:${tier.color};">${tier.label} Banana!</strong></div>
      <div>You earned ${coins} coins!</div>
      <button class="primary-btn" id="peel-collect">Collect</button>
    `;
    stage.appendChild(overlay);
    document.getElementById('peel-collect').addEventListener('click', () => onEnd(coins));
  }
}
