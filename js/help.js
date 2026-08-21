// Help modal: a static, player-facing explanation of the game's systems —
// no state/store needed, just opens a big scrollable reference via the
// usual modal (see openModal() in ui.js). Grouped into <details> sections
// so a new player can skim headings instead of facing one wall of text.

import { openModal } from './ui.js';

const SECTIONS = [
  {
    title: '🏠 The Basics',
    open: true,
    body: `
      <p>Xinny has six stats — <strong>Food, Water, Sleep, Fun, Health,</strong> and <strong>Love</strong> — shown as bars along the top. They drain over time, and a well-cared-for Xinny is happier, moves faster, and drains slower overall.</p>
      <p>Hover any bar for its exact number and current rate. Hover the mood pill next to them (e.g. 😊 Happy) to see exactly why Xinny feels that way right now.</p>
    `,
  },
  {
    title: '🍽️ Feeding & Watering',
    body: `
      <p>Buy food and drinks in the Shop, then use <strong>Feed</strong> / <strong>Water</strong> to place them in the room. Xinny decides on its own when to go eat or drink — more eagerly the hungrier or thirstier it is — rather than eating the instant you place something.</p>
      <p>If you've placed a <strong>Table</strong>, Xinny carries food there to eat instead of eating on the spot. A placed <strong>Bed</strong> gets walked to before napping.</p>
      <p>Health has no direct button — it drains when other needs run low or the room's a mess, and slowly recovers on its own once everything's in good shape and the floor is clean.</p>
    `,
  },
  {
    title: '🖐️ Pet / Play / Exercise / Scold',
    body: `
      <p>The sidebar next to Xinny arms one interaction at a time — click a button, then click (or click-and-hold, for Pet) Xinny to use it. Each of Pet/Play/Exercise draws from its own energy meter that refills on its own.</p>
      <ul>
        <li><strong>Pet</strong> — click and hold. Xinny starts sleepy and content; hold too long and it goes from exhausted to genuinely annoyed (mad) — let go before the meter maxes out.</li>
        <li><strong>Play</strong> — a quick fun + love boost. Needs <strong>Toys</strong> placed in the room to unlock.</li>
        <li><strong>Exercise</strong> — trades food/water for health + fun. Needs <strong>Weights</strong> placed in the room to unlock.</li>
        <li><strong>Scold</strong> — hurts love and fun but turns up a little pocket change. Use sparingly.</li>
        <li><strong>Move</strong> — arm it, then click the floor to send Xinny walking there.</li>
      </ul>
    `,
  },
  {
    title: '🧹 Messes & Mood',
    body: `
      <p>Spills, crumbs, and clutter turn up from eating, drinking, tripping, or boredom. Click one to clean it up (a small love + fun reward for the effort). Left alone, each mess quietly drags down fun, love, and especially health — and six or more messes at once makes Xinny sad outright, regardless of how good the actual stats are.</p>
      <p>Xinny can also randomly trip — more likely the messier the room is. While it's down, use Pet to comfort it and recover some of the damage.</p>
    `,
  },
  {
    title: '🌗 Day & Night',
    body: `
      <p>The badge next to the mood pill (☀️/🌙 with a day number) tracks a repeating cycle — 3 minutes of day, 1 minute of night. Sleep drains faster at night and slower during the day; hover the badge for a countdown to the next switch.</p>
      <p><strong>Every 5th day, the landlord collects rent.</strong> If you're around when it happens, you get a few seconds of whack-a-mole to win some of it back — every hit refunds a slice, up to the full amount taken. Miss it and it's just quietly deducted.</p>
    `,
  },
  {
    title: '🛍️ Shop & Decorating',
    body: `
      <p>The Shop sells food/water/medicine (used up), decorations and pets (bought once, then placed), and outfit/hair/ears customization (bought once, then equipped — exactly one of each active at a time). <strong>Travel</strong> unlocks new rooms, which in turn unlock exclusive items in every other category.</p>
      <p>Many decorations do more than look nice — hover or check an item's card in the shop for what it actually does (faster sleep regen, slower stat decay, bonus gains, and so on). Use <strong>Decorate</strong> to drag placed items around or pick them back up.</p>
    `,
  },
  {
    title: '🎮 Mini-Games',
    body: `
      <p>The <strong>Games</strong> button opens a handful of arcade-style mini-games that pay out coins — some have a cooldown before you can play again. They're the main way to earn money beyond Scold's spare change.</p>
    `,
  },
  {
    title: '🏆 Winning',
    body: `
      <p>Collect every purchasable item in the Shop and keep all six stats at 75% or higher, and the trophy button next to the Shop's title lights up. Click it once to see your reward — after that, it stays unlockable forever, even if your stats dip later.</p>
    `,
  },
];

export function openHelp() {
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <h2>❓ How to Play</h2>
    <div class="help-content">
      ${SECTIONS.map((s) => `
        <details class="help-section" ${s.open ? 'open' : ''}>
          <summary>${s.title}</summary>
          ${s.body}
        </details>
      `).join('')}
    </div>
  `;
  openModal(wrap);
}
