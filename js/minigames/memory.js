// "Match & Match" memory mini-game: flip cards to find pairs. Fewer moves
// earns more coins. Self-contained: mounts into a container and reports
// coins earned via onEnd().

const SYMBOLS = ['🍎', '🍰', '🌸', '🎈', '🧣', '🪴', '⭐', '🎀'];

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function mountMemoryGame(container, { onEnd }) {
  const deck = shuffled([...SYMBOLS, ...SYMBOLS]).map((symbol, i) => ({ id: i, symbol, flipped: false, matched: false }));

  container.innerHTML = `
    <div class="game-hud">
      <span>🔁 Moves: <span id="mem-moves">0</span></span>
      <span>🪙 <span id="mem-coins-preview">36</span> coins if you win now</span>
    </div>
    <div class="memory-grid" id="mem-grid"></div>
  `;

  const grid = container.querySelector('#mem-grid');
  const movesEl = container.querySelector('#mem-moves');
  const previewEl = container.querySelector('#mem-coins-preview');

  let moves = 0;
  let matchedCount = 0;
  let flippedIds = [];
  let locked = false;

  function coinsForMoves(m) {
    return Math.max(8, 36 - Math.max(0, m - 8) * 2);
  }

  function render() {
    grid.innerHTML = deck.map((c) => `
      <div class="memory-card ${c.flipped || c.matched ? 'flipped' : ''} ${c.matched ? 'matched' : ''}" data-id="${c.id}">
        ${c.flipped || c.matched ? c.symbol : '❓'}
      </div>
    `).join('');
    previewEl.textContent = coinsForMoves(moves || 0);
  }

  function onCardClick(e) {
    if (locked) return;
    const cardEl = e.target.closest('.memory-card');
    if (!cardEl) return;
    const id = Number(cardEl.dataset.id);
    const card = deck[id];
    if (!card || card.flipped || card.matched) return;

    card.flipped = true;
    flippedIds.push(id);
    render();

    if (flippedIds.length === 2) {
      moves++;
      movesEl.textContent = moves;
      const [a, b] = flippedIds.map((i) => deck[i]);
      if (a.symbol === b.symbol) {
        a.matched = true; b.matched = true;
        matchedCount += 2;
        flippedIds = [];
        render();
        if (matchedCount === deck.length) endGame();
      } else {
        locked = true;
        setTimeout(() => {
          a.flipped = false; b.flipped = false;
          flippedIds = [];
          locked = false;
          render();
        }, 700);
      }
    }
  }

  function endGame() {
    grid.removeEventListener('click', onCardClick);
    const coins = coinsForMoves(moves);
    const overlay = document.createElement('div');
    overlay.className = 'game-overlay-msg';
    overlay.style.position = 'absolute';
    overlay.style.inset = '0';
    overlay.innerHTML = `
      <div style="font-size:32px;">🧩</div>
      <div><strong>Solved in ${moves} moves!</strong></div>
      <div>You earned ${coins} coins!</div>
      <button class="primary-btn" id="mem-collect">Collect</button>
    `;
    container.style.position = 'relative';
    container.appendChild(overlay);
    document.getElementById('mem-collect').addEventListener('click', () => onEnd(coins));
  }

  grid.addEventListener('click', onCardClick);
  render();
}
