// "Sneaky Sniff" mini-game: press and hold the stinky shoe to sniff it,
// but only while nobody's watching — a "Grandma's footsteps"-style timing
// game. Getting caught mid-sniff costs a life and some progress. Self-
// contained: mounts into a container and reports coins earned via onEnd().

const GAME_SECONDS = 30;
const LIVES = 3;
const PROGRESS_PER_SEC = 22; // % filled per second while safely sniffing
const CAUGHT_PROGRESS_PENALTY = 15;
const CHECK_MIN_MS = 900;
const CHECK_MAX_MS = 2200; // random gap before the watcher flips state
const PEEK_WARNING_MS = 550; // how far ahead of "watching" the peek warning shows

export function mountShoeSniffGame(container, { onEnd }) {
  container.innerHTML = `
    <div class="game-hud">
      <span>⏱ <span id="sniff-time">${GAME_SECONDS}</span>s</span>
      <span id="sniff-lives">❤️❤️❤️</span>
    </div>
    <div class="game-stage sniff-stage" id="sniff-stage">
      <div class="sniff-watcher" id="sniff-watcher">🙈</div>
      <div class="sniff-progress-track"><div class="sniff-progress-fill" id="sniff-progress"></div></div>
      <img class="sniff-shoe" id="sniff-shoe" src="assets/icons/minigames/stinky-shoe.png" alt="stinky shoe">
      <div class="sniff-caught-msg" id="sniff-caught">Caught!</div>
    </div>
    <p style="font-size:12px;color:var(--ink-soft);margin-top:6px;">Press and hold the shoe to sniff it — but let go the instant you're being watched!</p>
  `;

  const stage = container.querySelector('#sniff-stage');
  const shoe = container.querySelector('#sniff-shoe');
  const watcherEl = container.querySelector('#sniff-watcher');
  const progressFill = container.querySelector('#sniff-progress');
  const timeEl = container.querySelector('#sniff-time');
  const livesEl = container.querySelector('#sniff-lives');
  const caughtMsg = container.querySelector('#sniff-caught');

  let progress = 0;
  let lives = LIVES;
  let timeLeft = GAME_SECONDS;
  let running = true;
  let watching = false;
  let peeking = false; // brief warning right before "not watching" flips to "watching"
  let sniffing = false;
  let watchTimer = null;
  let peekTimer = null;
  let rafId = null, lastTs = null;

  function scheduleNextToggle() {
    const delay = CHECK_MIN_MS + Math.random() * (CHECK_MAX_MS - CHECK_MIN_MS);
    // Only the "about to start watching" direction gets a warning — that's
    // the dangerous one. Going the other way (watching -> not watching)
    // doesn't need a tell, since there's nothing to react to.
    if (!watching) {
      peekTimer = setTimeout(() => {
        if (!running || watching) return;
        peeking = true;
        updateWatcherVisual();
      }, Math.max(0, delay - PEEK_WARNING_MS));
    }
    watchTimer = setTimeout(() => {
      if (!running) return;
      watching = !watching;
      peeking = false;
      updateWatcherVisual();
      if (watching && sniffing) caught();
      scheduleNextToggle();
    }, delay);
  }

  function updateWatcherVisual() {
    watcherEl.textContent = watching ? '👀' : (peeking ? '🫣' : '🙈');
    watcherEl.classList.toggle('watching', watching);
    watcherEl.classList.toggle('peeking', peeking && !watching);
  }

  function caught() {
    lives--;
    livesEl.textContent = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(LIVES - Math.max(0, lives));
    progress = Math.max(0, progress - CAUGHT_PROGRESS_PENALTY);
    progressFill.style.width = `${progress}%`;
    sniffing = false;
    shoe.classList.remove('sniffing');
    caughtMsg.classList.add('show');
    setTimeout(() => caughtMsg.classList.remove('show'), 500);
    stage.classList.add('caught-flash');
    setTimeout(() => stage.classList.remove('caught-flash'), 400);
    if (lives <= 0) endGame(false);
  }

  function startSniff(e) {
    e.preventDefault();
    if (!running) return;
    if (watching) { caught(); return; }
    sniffing = true;
    shoe.classList.add('sniffing');
  }
  function stopSniff() {
    sniffing = false;
    shoe.classList.remove('sniffing');
  }
  shoe.addEventListener('mousedown', startSniff);
  shoe.addEventListener('touchstart', startSniff, { passive: false });
  window.addEventListener('mouseup', stopSniff);
  window.addEventListener('touchend', stopSniff);

  function loop(ts) {
    if (!running) return;
    if (!lastTs) lastTs = ts;
    const dt = (ts - lastTs) / 1000;
    lastTs = ts;

    if (sniffing && !watching) {
      progress = Math.min(100, progress + PROGRESS_PER_SEC * dt);
      progressFill.style.width = `${progress}%`;
      if (progress >= 100) { endGame(true); return; }
    }
    rafId = requestAnimationFrame(loop);
  }

  const countdownId = setInterval(() => {
    timeLeft--;
    timeEl.textContent = timeLeft;
    if (timeLeft <= 0) endGame(progress >= 100);
  }, 1000);

  function endGame(won) {
    if (!running) return;
    running = false;
    clearInterval(countdownId);
    clearTimeout(watchTimer);
    clearTimeout(peekTimer);
    if (rafId) cancelAnimationFrame(rafId);
    shoe.removeEventListener('mousedown', startSniff);
    shoe.removeEventListener('touchstart', startSniff);
    window.removeEventListener('mouseup', stopSniff);
    window.removeEventListener('touchend', stopSniff);

    const coins = won ? Math.round(10 + lives * 6) : Math.round(progress / 6);
    const overlay = document.createElement('div');
    overlay.className = 'game-overlay-msg';
    overlay.innerHTML = `
      <div style="font-size:32px;">${won ? '👃✨' : '😳'}</div>
      <div><strong>${won ? 'Sniffed it clean!' : "Busted before you finished!"}</strong></div>
      <div>You earned ${coins} coins!</div>
      <button class="primary-btn" id="sniff-collect">Collect</button>
    `;
    stage.appendChild(overlay);
    document.getElementById('sniff-collect').addEventListener('click', () => onEnd(coins));
  }

  updateWatcherVisual();
  scheduleNextToggle();
  rafId = requestAnimationFrame(loop);
}
