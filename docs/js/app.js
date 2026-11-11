// Memory Kids — interfaccia e logica dell'app
import * as D from './data.js';
import { MemoryGame, buildDeck, shuffle, starsFor } from './engine.js';
import * as Store from './storage.js';
import * as Audio from './audio.js';
import { createMascot } from './mascot.js';

export const VERSION = '1.0.0';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const fmtTime = (s) => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

let P = Store.load();
const persist = () => Store.save(P);

// ================= Navigazione =================
const stack = ['splash'];
let current = 'splash';

function show(id, { push = true } = {}) {
  const prev = $(`#screen-${current}`);
  const next = $(`#screen-${id}`);
  if (!next || id === current) return;
  prev?.classList.remove('active');
  next.classList.add('active');
  next.querySelector('.scroll')?.scrollTo(0, 0);
  if (push) { stack.push(id); try { history.pushState({ s: id }, ''); } catch (e) { /* */ } }
  current = id;
  onEnter(id);
}

function back() {
  if (current === 'game') {
    if (!$('#overlay-win').hidden && game?.over) { $('#overlay-win').hidden = true; goHome(); return; }
    pauseGame(); return;
  }
  if (stack.length <= 2) { show('home', { push: false }); stack.length = 0; stack.push('splash', 'home'); return; }
  stack.pop();
  show(stack[stack.length - 1], { push: false });
}

function goHome() {
  stack.length = 0; stack.push('splash', 'home');
  show('home', { push: false });
}

window.addEventListener('popstate', () => {
  if (current === 'splash') return;
  if (current === 'home') { try { history.pushState({ s: 'home' }, ''); } catch (e) { /* */ } return; }
  back();
});

function onEnter(id) {
  Audio.setMusicStyle(id === 'game' && game?.mode === 'relax' ? 'calm' : 'happy');
  if (id === 'home') renderHome();
  if (id === 'modes') renderModes();
  if (id === 'levels') renderLevels();
  if (id === 'categories') renderCategories();
  if (id === 'awards') renderAwards();
  if (id === 'themes') renderThemes();
  if (id === 'stats') renderStats();
  if (id === 'settings') renderSettings();
  if (id === 'install') renderInstall();
}

document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) { Audio.play('tap'); show(go.dataset.go); return; }
  if (e.target.closest('[data-back]')) { Audio.play('tap'); back(); }
});

// ================= Tema & sfondo =================
function applyTheme() {
  const t = D.THEMES.find((x) => x.id === P.theme) ?? D.THEMES[0];
  const r = document.documentElement.style;
  r.setProperty('--bg1', t.bg[0]); r.setProperty('--bg2', t.bg[1]); r.setProperty('--bg3', t.bg[2]);
  r.setProperty('--back1', t.back[0]); r.setProperty('--back2', t.back[1]);
  r.setProperty('--pattern', `'${t.pattern}'`);
  document.body.classList.toggle('dark', !!t.dark);
  const meta = $('meta[name=theme-color]'); if (meta) meta.content = t.back[0];
  const fl = $('#floaters');
  const pool = [t.pattern, '⭐', '💖', '✨', '🎈', '🌸', t.icon];
  fl.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const s = document.createElement('span');
    s.textContent = pick(pool);
    s.style.left = `${Math.random() * 95}%`;
    s.style.fontSize = `${20 + Math.random() * 22}px`;
    const dur = 16 + Math.random() * 14;
    s.style.animationDuration = `${dur}s`;
    s.style.animationDelay = `${-Math.random() * dur}s`;
    fl.appendChild(s);
  }
}

// ================= Effetti =================
const toastsEl = $('#toasts');
function toast(icon, title, sub = '') {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<span class="ti">${icon}</span><div>${title}${sub ? `<small>${sub}</small>` : ''}</div>`;
  toastsEl.appendChild(t);
  setTimeout(() => t.remove(), 3800);
}

function vibrate(pattern) {
  if (P.settings.haptics && navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) { /* */ } }
}

function sparkAt(el, emojis = ['✨', '⭐', '💖', '🌟']) {
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2; const cy = r.top + r.height / 2;
  for (let i = 0; i < 7; i++) {
    const s = document.createElement('span');
    s.className = 'spark';
    s.textContent = pick(emojis);
    const a = (Math.PI * 2 * i) / 7 + Math.random() * 0.5;
    const d = 40 + Math.random() * 40;
    s.style.left = `${cx}px`; s.style.top = `${cy}px`;
    s.style.setProperty('--dx', `${Math.cos(a) * d}px`);
    s.style.setProperty('--dy', `${Math.sin(a) * d}px`);
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 950);
  }
}

function floatText(el, text) {
  const r = el.getBoundingClientRect();
  const f = document.createElement('div');
  f.className = 'float-text'; f.textContent = text;
  f.style.left = `${r.left + r.width / 2}px`; f.style.top = `${r.top}px`;
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1150);
}

// Coriandoli su canvas
const cv = $('#confetti');
const cx2 = cv.getContext('2d');
let confetti = [];
let confettiRAF = null;
function confettiBurst(count = 140) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  cx2.setTransform(dpr, 0, 0, dpr, 0, 0);
  const colors = ['#ff5fa2', '#ffcd4d', '#4fcf6f', '#3fb8ff', '#9a6bff', '#ff9a3d'];
  for (let i = 0; i < count; i++) {
    confetti.push({
      x: innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.3,
      y: innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4,
      s: 6 + Math.random() * 8, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
      c: pick(colors), shape: Math.random() < 0.3 ? 'c' : 'r', life: 0,
    });
  }
  if (!confettiRAF) confettiRAF = requestAnimationFrame(drawConfetti);
}
function drawConfetti() {
  cx2.clearRect(0, 0, innerWidth, innerHeight);
  confetti = confetti.filter((p) => p.y < innerHeight + 40 && p.life < 400);
  for (const p of confetti) {
    p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life++;
    cx2.save(); cx2.translate(p.x, p.y); cx2.rotate(p.r); cx2.fillStyle = p.c;
    if (p.shape === 'c') { cx2.beginPath(); cx2.arc(0, 0, p.s / 2, 0, Math.PI * 2); cx2.fill(); }
    else cx2.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
    cx2.restore();
  }
  if (confetti.length) confettiRAF = requestAnimationFrame(drawConfetti);
  else { confettiRAF = null; cx2.clearRect(0, 0, innerWidth, innerHeight); }
}

// ================= Mascotte =================
const splashMascot = createMascot($('#splash-mascot'));
const homeMascot = createMascot($('#home-mascot'));
const gameMascot = createMascot($('#game-mascot'));
const winMascot = createMascot($('#win-mascot'));
$('#home-mascot').addEventListener('click', () => {
  Audio.play('pop'); homeMascot.mood('happy'); homeMascot.act('spin'); homeMascot.say(pick(D.MSG.welcome));
});
$('#game-mascot').addEventListener('click', () => { Audio.play('pop'); gameMascot.act('jump'); gameMascot.say(pick(D.MSG.start)); });

// ================= Home =================
function renderHome() {
  $('#home-stars').textContent = `⭐ ${P.stars}`;
  const rk = Store.rankFor(P.xp);
  $('#home-rank .rank-name').textContent = `${rk.icon} ${rk.name}`;
  $('#home-rank .bar i').style.width = `${Math.round(rk.progress * 100)}%`;
  $('#btn-continue').classList.toggle('hidden', !P.savedGame);
  setTimeout(() => { homeMascot.act('jump'); homeMascot.say(pick(D.MSG.welcome), 3200); }, 350);
}

$('#btn-continue').addEventListener('click', () => {
  Audio.play('tap');
  if (P.savedGame) startGame(P.savedGame.cfg, P.savedGame);
});

// ================= Selezione =================
const sel = { mode: 'classic', n: 1 };

function renderModes() {
  const list = $('#mode-list');
  list.innerHTML = '';
  D.MODES.forEach((m, i) => {
    const b = document.createElement('button');
    b.className = 'mode-card';
    b.style.cssText = `--c1:${m.color[0]};--c2:${m.color[1]};animation-delay:${i * 0.06}s`;
    b.innerHTML = `<span class="mi">${m.icon}</span><span><b>${m.name}</b><small>${m.desc}</small></span>`;
    b.addEventListener('click', () => { Audio.play('tap'); sel.mode = m.id; show('levels'); });
    list.appendChild(b);
  });
}

function levelListFor(mode) {
  if (mode === 'super') return D.SUPER_LEVELS;
  if (mode === 'challenge') return D.CHALLENGE_STAGES;
  return D.LEVELS;
}

function renderLevels() {
  const mode = D.MODES.find((m) => m.id === sel.mode);
  $('#levels-title').textContent = `${mode.icon} ${mode.name}`;
  const hints = {
    classic: 'Scegli un livello. Finiscine uno per sbloccare il successivo!',
    time: 'Trova tutte le coppie prima che la barra finisca!',
    challenge: 'Supera le tappe una dopo l\'altra fino alla vetta! 🏔️',
    relax: 'Gioca con calma: niente orologio! 🌙',
    super: 'Carte di più categorie mescolate: per memorie super!',
  };
  $('#levels-hint').textContent = hints[sel.mode];
  const grid = $('#level-grid');
  grid.innerHTML = '';
  const levels = levelListFor(sel.mode);
  const nextOpen = sel.mode === 'super' ? P.unlocked.super : sel.mode === 'challenge' ? P.unlocked.challenge : P.unlocked.level;
  levels.forEach((l, i) => {
    const open = Store.isLevelUnlocked(P, sel.mode, l.n);
    const st = P.levelStars[Store.keyFor(sel.mode, l.n)] ?? 0;
    const b = document.createElement('button');
    b.className = `level-btn${open ? '' : ' locked'}${open && l.n === nextOpen && !st ? ' next' : ''}`;
    b.style.cssText = `--c1:${mode.color[0]};--c2:${mode.color[1]};animation-delay:${i * 0.04}s`;
    const label = sel.mode === 'challenge' ? `Tappa` : sel.mode === 'super' ? 'Super' : 'Livello';
    b.innerHTML = `<span class="cards">${label}</span><span class="num">${l.n}</span><span class="cards">${l.cards} carte</span>
      <span class="lstars">${[1, 2, 3].map((k) => `<span class="${k <= st ? '' : 'off'}">⭐</span>`).join('')}</span>`;
    b.setAttribute('aria-label', `${label} ${l.n}, ${l.cards} carte${open ? '' : ', bloccato'}`);
    b.addEventListener('click', () => {
      if (!open) {
        Audio.play('miss'); b.animate([{ transform: 'rotate(-6deg)' }, { transform: 'rotate(6deg)' }, { transform: 'none' }], { duration: 300 });
        toast('🔒', 'Ancora chiuso!', `Completa ${sel.mode === 'challenge' ? 'la tappa' : 'il livello'} ${l.n - 1} per aprirlo`);
        return;
      }
      Audio.play('tap');
      sel.n = l.n;
      if (sel.mode === 'challenge') {
        const cat = D.CATEGORIES[(l.n * 5) % D.CATEGORIES.length].id;
        startGame({ mode: 'challenge', n: l.n, category: cat });
      } else if (sel.mode === 'super') {
        startGame({ mode: 'super', n: l.n, category: 'mix' });
      } else show('categories');
    });
    grid.appendChild(b);
  });
}

function renderCategories() {
  const grid = $('#cat-grid');
  grid.innerHTML = '';
  const rnd = document.createElement('button');
  rnd.className = 'cat-btn random';
  rnd.innerHTML = '<span class="ci">🎁</span>Sorpresa!<span class="cprev">❓❓❓</span>';
  rnd.addEventListener('click', () => { Audio.play('tap'); startGame({ mode: sel.mode, n: sel.n, category: pick(D.CATEGORIES).id }); });
  grid.appendChild(rnd);
  D.CATEGORIES.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'cat-btn';
    b.style.cssText = `--c1:${c.color[0]};--c2:${c.color[1]};animation-delay:${(i + 1) * 0.03}s`;
    b.innerHTML = `<span class="ci">${c.icon}</span>${c.name}<span class="cprev">${c.items.slice(1, 4).join(' ')}</span>`;
    b.addEventListener('click', () => { Audio.play('tap'); P.lastCategory = c.id; persist(); startGame({ mode: sel.mode, n: sel.n, category: c.id }); });
    grid.appendChild(b);
  });
}

// ================= Partita =================
let game = null; // stato della partita in corso

function configFor(cfg) {
  const mode = cfg.mode;
  let level;
  if (mode === 'super') level = D.SUPER_LEVELS.find((l) => l.n === cfg.n);
  else if (mode === 'challenge') level = D.CHALLENGE_STAGES.find((l) => l.n === cfg.n);
  else level = D.LEVELS.find((l) => l.n === cfg.n);
  const pairs = level.cards / 2;
  return {
    ...cfg,
    cards: level.cards,
    pairs,
    preview: level.preview ?? 0,
    mix: level.mix ?? 0,
    countdown: mode === 'time',
    limit: mode === 'time' ? D.timeLimitFor(pairs) : 0,
    showClock: mode === 'time' || (mode !== 'relax' && P.settings.timer),
  };
}

function poolFor(cfg) {
  if (cfg.category !== 'mix') return D.CATEGORIES.find((c) => c.id === cfg.category).items;
  const cats = shuffle(D.CATEGORIES).slice(0, Math.max(cfg.mix, 2));
  return cats.flatMap((c) => c.items);
}

function startGame(cfgIn, saved = null) {
  Audio.unlock();
  const cfg = configFor(cfgIn);
  const deck = saved ? saved.state.deck : buildDeck(poolFor(cfg), cfg.pairs);
  const engine = new MemoryGame(deck, saved?.state);

  clearGameTimers();
  game = {
    cfg, engine, mode: cfg.mode,
    elapsed: saved?.elapsed ?? 0,
    timeLeft: saved?.timeLeft ?? cfg.limit,
    extended: saved?.extended ?? false,
    running: false, paused: false, over: false,
    lastTick: 0, timer: null, idleT: null, mismatchT: null,
  };
  P.savedGame = null; persist();

  const modeDef = D.MODES.find((m) => m.id === cfg.mode);
  const catName = cfg.category === 'mix' ? 'Mix di categorie' : D.CATEGORIES.find((c) => c.id === cfg.category).name;
  const lvl = cfg.mode === 'challenge' ? `Tappa ${cfg.n}` : cfg.mode === 'super' ? `Super ${cfg.n}` : `Livello ${cfg.n}`;
  $('#game-title').textContent = `${modeDef.icon} ${modeDef.name} · ${lvl} · ${catName}`;

  $('#hud-time').classList.toggle('hidden', !cfg.showClock);
  $('#hud-moves').classList.toggle('hidden', cfg.mode === 'relax');
  $('#timebar').classList.toggle('hidden', !cfg.countdown);
  $('#hud-time small').textContent = cfg.countdown ? 'Restano' : 'Tempo';

  buildBoard();
  updateHud();
  $('#overlay-win').hidden = true; $('#overlay-pause').hidden = true;
  if (current !== 'game') show('game');
  else onEnter('game');

  gameMascot.say(saved ? 'Riprendiamo da dove eravamo! 😊' : pick(D.MSG.start), 2600);

  if (cfg.preview > 0 && !saved) doPreview(cfg.preview);
  else beginRunning();
}

function doPreview(seconds) {
  const cards = $$('#board .card');
  game.engine.locked = true;
  setTimeout(() => cards.forEach((c) => c.classList.add('up')), 450);
  const wrap = $('#board-wrap');
  const cd = document.createElement('div');
  cd.className = 'countdown';
  wrap.appendChild(cd);
  let left = seconds;
  const tickCd = () => {
    if (!game) return;
    cd.innerHTML = `<b>👀 ${left}</b>`;
    Audio.play('tick');
    if (left-- <= 0) {
      cd.remove();
      cards.forEach((c) => c.classList.remove('up'));
      game.engine.locked = false;
      beginRunning();
      return;
    }
    game.previewT = setTimeout(tickCd, 1000);
  };
  game.previewT = setTimeout(tickCd, 500);
}

function beginRunning() {
  game.running = true;
  game.lastTick = performance.now();
  game.timer = setInterval(tick, 250);
  resetIdle();
}

function clearGameTimers() {
  if (!game) return;
  clearInterval(game.timer); clearTimeout(game.idleT); clearTimeout(game.mismatchT); clearTimeout(game.mismatchT2); clearTimeout(game.previewT);
  $('#board-wrap .countdown')?.remove();
}

function tick() {
  if (!game || !game.running || game.paused || game.over) return;
  const now = performance.now();
  const dt = (now - game.lastTick) / 1000;
  game.lastTick = now;
  game.elapsed += dt;
  if (game.cfg.countdown) {
    game.timeLeft -= dt;
    if (game.timeLeft <= 0) { game.timeLeft = 0; updateHud(); timeUp(); return; }
  }
  updateHud();
}

function updateHud() {
  const e = game.engine;
  $('#hud-moves b').textContent = e.moves;
  $('#hud-pairs b').textContent = `${e.pairsFound}/${e.pairs}`;
  const t = $('#hud-time');
  if (game.cfg.countdown) {
    t.querySelector('b').textContent = fmtTime(game.timeLeft);
    const frac = game.timeLeft / (game.cfg.limit + (game.extended ? 30 : 0));
    $('#timebar i').style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
    $('#timebar').classList.toggle('low', game.timeLeft < 10);
    t.classList.toggle('warn', game.timeLeft < 10);
  } else {
    t.querySelector('b').textContent = fmtTime(game.elapsed);
  }
}

function bump(id) {
  const el = $(id); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
}

function buildBoard() {
  const board = $('#board');
  board.innerHTML = '';
  board.classList.remove('paused');
  const deck = game.engine.deck;
  const catFor = (sym) => D.CATEGORIES.find((c) => c.items.includes(sym));
  deck.forEach((sym, i) => {
    const cat = game.cfg.category === 'mix' ? catFor(sym) : D.CATEGORIES.find((c) => c.id === game.cfg.category);
    const c = document.createElement('button');
    c.className = 'card';
    c.dataset.i = i;
    c.style.animationDelay = `${Math.min(i * 0.025, 0.8)}s`;
    c.style.setProperty('--f1', cat.color[0]);
    c.style.setProperty('--f2', `${cat.color[1]}33`);
    c.setAttribute('aria-label', 'Carta coperta');
    c.innerHTML = `<div class="inner"><div class="face back"></div><div class="face front"><span>${sym}</span></div></div>`;
    if (game.engine.matched.has(i)) c.classList.add('up', 'done');
    board.appendChild(c);
  });
  fitBoard();
}

function fitBoard() {
  if (!game) return;
  const wrap = $('#board-wrap');
  const W = wrap.clientWidth; const H = wrap.clientHeight;
  if (!W || !H) return;
  const n = game.engine.deck.length;
  const ratio = 1.22;
  const gap = Math.max(6, Math.min(14, Math.min(W, H) * 0.018));
  let best = null;
  for (let cols = 2; cols <= Math.min(n, 10); cols++) {
    const rows = Math.ceil(n / cols);
    const cw = Math.min((W - gap * (cols - 1)) / cols, (H - gap * (rows - 1)) / rows / ratio, 150);
    const empty = rows * cols - n;
    const score = cw * (1 - 0.04 * empty);
    if (!best || score > best.score) best = { cols, cw, score };
  }
  const st = $('#board').style;
  st.setProperty('--cols', best.cols);
  st.setProperty('--cw', `${Math.floor(best.cw)}px`);
  st.setProperty('--ch', `${Math.floor(best.cw * ratio)}px`);
  st.setProperty('--gap', `${Math.floor(gap)}px`);
}

window.addEventListener('resize', () => { setVh(); fitBoard(); });

$('#board').addEventListener('click', (e) => {
  const card = e.target.closest('.card');
  if (!card || !game || game.over || game.paused) return;
  if (!game.running) return;
  const i = Number(card.dataset.i);
  const res = game.engine.flip(i);
  if (res.type === 'ignored') return;
  resetIdle();
  Audio.play('flip');
  vibrate(10);
  card.classList.add('up');
  card.setAttribute('aria-label', `Carta ${game.engine.deck[i]}`);

  if (res.type === 'match') {
    const a = $(`#board .card[data-i="${res.a}"]`); const b = $(`#board .card[data-i="${res.b}"]`);
    setTimeout(() => {
      a.classList.add('done'); b.classList.add('done');
      Audio.play('match'); vibrate([20, 40, 20]);
      sparkAt(a); sparkAt(b);
      if (res.combo >= 2) floatText(b, `Combo x${res.combo}! 🔥`);
      else floatText(b, '+100');
      gameMascot.mood('happy'); gameMascot.act('jump');
      gameMascot.say(res.combo >= 3 ? pick(D.MSG.combo) : pick(D.MSG.match), 1600);
      bump('#hud-pairs'); updateHud();
      if (res.finished) win();
    }, 380);
    bump('#hud-moves'); updateHud();
    saveProgressSnapshot();
  } else if (res.type === 'mismatch') {
    bump('#hud-moves'); updateHud();
    const a = $(`#board .card[data-i="${res.a}"]`); const b = $(`#board .card[data-i="${res.b}"]`);
    game.mismatchT = setTimeout(() => {
      a.classList.add('miss'); b.classList.add('miss');
      Audio.play('miss');
      if (Math.random() < 0.5) { gameMascot.mood('wow'); gameMascot.say(pick(D.MSG.miss), 1500); }
    }, 450);
    const eng = game.engine;
    game.mismatchT2 = setTimeout(() => {
      if (!game || game.engine !== eng) return;
      eng.hideMismatch();
      if (game.timedOut) eng.locked = true;
      [a, b].forEach((c) => { c.classList.remove('miss', 'up'); c.setAttribute('aria-label', 'Carta coperta'); });
    }, 1150);
    saveProgressSnapshot();
  }
});

function resetIdle() {
  clearTimeout(game?.idleT);
  if (!game) return;
  game.idleT = setTimeout(() => {
    if (!game || game.over || game.paused || current !== 'game') return;
    gameMascot.act('jump');
    gameMascot.say('Tocca una carta! 👆', 2500);
    resetIdle();
  }, 15000);
}

function saveProgressSnapshot() {
  if (!game || game.engine.finished) return;
  P.savedGame = {
    cfg: { mode: game.cfg.mode, n: game.cfg.n, category: game.cfg.category },
    state: game.engine.serialize(),
    elapsed: game.elapsed, timeLeft: game.timeLeft, extended: game.extended,
  };
  persist();
}

// ----- pausa -----
function pauseGame() {
  if (!game || game.over || game.paused) return;
  game.paused = true;
  $('#board').classList.add('paused');
  saveProgressSnapshot();
  updatePauseToggles();
  $('#overlay-pause').hidden = false;
  Audio.play('tap');
}
function resumeGame() {
  if (!game) return;
  game.paused = false;
  game.lastTick = performance.now();
  $('#board').classList.remove('paused');
  $('#overlay-pause').hidden = true;
  Audio.play('tap');
  resetIdle();
}
function updatePauseToggles() {
  $('#pause-sfx').classList.toggle('off', !P.settings.sfx);
  $('#pause-music').classList.toggle('off', !P.settings.music);
}
$('#btn-pause').addEventListener('click', pauseGame);
$('#btn-resume').addEventListener('click', resumeGame);
$('#btn-pause-home').addEventListener('click', () => { $('#overlay-pause').hidden = true; leaveGame(); });
$('#btn-pause-restart').addEventListener('click', () => { $('#overlay-pause').hidden = true; restartGame(); });
$('#btn-restart').addEventListener('click', () => {
  if (!game || game.over) return;
  if (game.engine.moves === 0) { restartGame(); return; }
  const wasPaused = game.paused; game.paused = true;
  confirmDialog('🔄', 'Ricominciare?', 'Le carte verranno mescolate di nuovo.', () => restartGame(), () => { game.paused = wasPaused; game.lastTick = performance.now(); });
});
$('#pause-sfx').addEventListener('click', () => { setSetting('sfx', !P.settings.sfx); updatePauseToggles(); });
$('#pause-music').addEventListener('click', () => { setSetting('music', !P.settings.music); updatePauseToggles(); });

function restartGame() {
  if (!game) return;
  const cfg = { mode: game.cfg.mode, n: game.cfg.n, category: game.cfg.category };
  finalizePartial();
  startGame(cfg);
}

/** Partita lasciata a metà: salva comunque statistiche e XP delle coppie trovate (mai penalità). */
function finalizePartial() {
  if (!game || game.over) return;
  const e = game.engine;
  if (e.pairsFound > 0 || game.timedOut) {
    Store.recordGame(P, {
      mode: game.cfg.mode, n: game.cfg.n, category: game.cfg.category, pairs: e.pairs, pairsFound: e.pairsFound,
      moves: e.moves, misses: e.misses, seconds: game.elapsed, stars: 0, score: 0, bestCombo: e.bestCombo, completed: false, timeWin: false,
    }, D);
  }
  P.savedGame = null;
  persist();
  game.over = true;
  clearGameTimers();
}

function leaveGame() {
  // la partita resta salvata per poterla continuare
  if (game && !game.over) {
    if (game.timedOut) finalizePartial();
    else { saveProgressSnapshot(); clearGameTimers(); game.over = true; }
  }
  goHome();
}

// ----- tempo scaduto -----
function timeUp() {
  game.running = false;
  game.timedOut = true;
  game.engine.locked = true;
  clearGameTimers();
  Audio.play('star');
  const e = game.engine;
  winMascot.mood('happy', 0);
  $('#win-title').textContent = 'Tempo finito! ⏰';
  $('#win-stars').classList.add('hidden');
  $('#win-stats').innerHTML = `<div><small>Coppie</small><b>${e.pairsFound}/${e.pairs}</b></div><div><small>Mosse</small><b>${e.moves}</b></div><div><small>Tempo</small><b>${fmtTime(game.elapsed)}</b></div>`;
  $('#win-rewards').innerHTML = `<div class="reward">${pick(D.MSG.timeUp)}</div>`;
  const btns = $('#win-buttons');
  btns.innerHTML = '';
  addBtn(btns, '⏰ +30 secondi', 'btn btn-play', () => {
    $('#overlay-win').hidden = true;
    game.timeLeft += 30; game.extended = true; game.timedOut = false;
    if (game.engine.open.length >= 2) {
      game.engine.hideMismatch();
      $$('#board .card:not(.done)').forEach((c) => c.classList.remove('up', 'miss'));
    }
    game.engine.locked = false;
    beginRunning(); updateHud();
    gameMascot.say('Forza, ce la fai! 💪');
  });
  addBtn(btns, '🔄 Riprova', 'btn btn-soft', () => { $('#overlay-win').hidden = true; restartGame(); });
  addBtn(btns, '🏠 Menu', 'btn btn-soft', () => { $('#overlay-win').hidden = true; finalizePartial(); goHome(); });
  $('#overlay-win').hidden = false;
  winMascot.act('jump');
}

function addBtn(parent, label, cls, fn) {
  const b = document.createElement('button');
  b.className = cls; b.textContent = label;
  b.addEventListener('click', () => { Audio.play('tap'); fn(); });
  parent.appendChild(b);
}

// ----- vittoria -----
function win() {
  const e = game.engine;
  game.over = true;
  game.running = false;
  clearGameTimers();
  P.savedGame = null;

  let stars = starsFor(e.moves, e.pairs);
  if (game.cfg.mode === 'relax') stars = Math.max(stars, 2);
  const timeWin = game.cfg.mode === 'time' && !game.extended;
  const score = e.score({ seconds: game.elapsed, timeLeft: game.cfg.countdown ? game.timeLeft : 0, timed: game.cfg.showClock });
  const result = Store.recordGame(P, {
    mode: game.cfg.mode, n: game.cfg.n, category: game.cfg.category, pairs: e.pairs, pairsFound: e.pairsFound,
    moves: e.moves, misses: e.misses, seconds: game.elapsed, stars, score, bestCombo: e.bestCombo, completed: true, timeWin,
  }, D);
  persist();

  setTimeout(() => showWin({ stars, score, result }), 700);
}

function showWin({ stars, score, result }) {
  const e = game.engine;
  Audio.play('win');
  vibrate([30, 60, 30, 60, 80]);
  confettiBurst(160);
  setTimeout(() => confettiBurst(80), 700);

  $('#win-title').textContent = pick(D.MSG.win);
  const st = $('#win-stars');
  st.classList.remove('hidden');
  const spans = $$('span', st);
  spans.forEach((s) => s.classList.remove('on'));
  spans.forEach((s, i) => { if (i < stars) setTimeout(() => { s.classList.add('on'); Audio.play('star'); }, 500 + i * 380); });

  $('#win-stats').innerHTML = `
    <div><small>Mosse</small><b>${e.moves}</b></div>
    <div><small>Tempo</small><b>${fmtTime(game.elapsed)}</b></div>
    <div><small>Punti</small><b>${score}</b></div>`;

  const rw = $('#win-rewards');
  const items = [];
  items.push(`<div class="reward">✨ +${result.xpGained} XP</div>`);
  items.push(`<div class="reward">⭐ +${result.starsGained}</div>`);
  if (result.record) items.push('<div class="reward record">🏅 Nuovo record!</div>');
  if (result.unlockedNext) items.push(`<div class="reward record">🔓 Sbloccato: ${result.unlockedNext.mode === 'challenge' ? 'Tappa' : result.unlockedNext.mode === 'super' ? 'Super' : 'Livello'} ${result.unlockedNext.n}</div>`);
  result.newMedals.forEach((m) => items.push(`<div class="reward">${m.icon} ${m.name}</div>`));
  result.newTrophies.forEach((m) => items.push(`<div class="reward record">${m.icon} ${m.name}</div>`));
  result.newThemes.forEach((t) => items.push(`<div class="reward">🎨 Tema ${t.name}</div>`));
  if (result.rankUp) items.push(`<div class="reward record">${result.rankUp.icon} Ora sei: ${result.rankUp.name}!</div>`);
  rw.innerHTML = items.join('');
  [...rw.children].forEach((c, i) => { c.style.animationDelay = `${1.2 + i * 0.15}s`; });

  // toast per le novità importanti
  let delay = 1800;
  [...result.newMedals.map((m) => ['🏅', `Nuova medaglia: ${m.name}`, m.desc]),
    ...result.newTrophies.map((m) => [m.icon, `Nuovo trofeo: ${m.name}`, m.desc]),
    ...result.newThemes.map((t) => ['🎨', `Nuovo tema: ${t.name}`, 'Provalo nella sezione Temi!'])]
    .forEach(([i, t, s]) => { setTimeout(() => { toast(i, t, s); Audio.play('unlock'); }, delay); delay += 900; });

  const btns = $('#win-buttons');
  btns.innerHTML = '';
  const cfg = game.cfg;
  const list = levelListFor(cfg.mode);
  const next = list.find((l) => l.n === cfg.n + 1);
  if (next && Store.isLevelUnlocked(P, cfg.mode, next.n)) {
    addBtn(btns, '➜ Avanti', 'btn btn-play', () => {
      $('#overlay-win').hidden = true;
      const category = cfg.mode === 'challenge' ? D.CATEGORIES[(next.n * 5) % D.CATEGORIES.length].id : cfg.category;
      startGame({ mode: cfg.mode, n: next.n, category });
    });
  }
  addBtn(btns, '🔄 Gioca ancora', next ? 'btn btn-soft' : 'btn btn-play', () => {
    $('#overlay-win').hidden = true;
    startGame({ mode: cfg.mode, n: cfg.n, category: cfg.mode === 'super' ? 'mix' : cfg.category });
  });
  addBtn(btns, '🏠 Menu', 'btn btn-soft', () => { $('#overlay-win').hidden = true; goHome(); });

  $('#overlay-win').hidden = false;
  winMascot.mood('happy', 0);
  winMascot.act('dance');
  gameMascot.mood('happy', 3000); gameMascot.act('dance');
}

// ================= Premi =================
function renderAwards() {
  const rk = Store.rankFor(P.xp);
  const medals = D.MEDALS.map((m) => `<div class="award ${P.medals[m.id] ? 'got' : 'locked'}"><span class="ai">${m.icon}</span><b>${m.name}</b><small>${m.desc}</small></div>`).join('');
  const trophies = D.TROPHIES.map((m) => `<div class="award trophy ${P.trophies[m.id] ? 'got' : 'locked'}"><span class="ai">${m.icon}</span><b>${m.name}</b><small>${m.desc}</small></div>`).join('');
  const nMed = Object.keys(P.medals).length; const nTro = Object.keys(P.trophies).length;
  $('#awards-body').innerHTML = `
    <div class="panel">
      <div class="summary">
        <div><b>⭐ ${P.stars}</b><small>Stelle</small></div>
        <div><b>✨ ${P.xp}</b><small>Punti esperienza</small></div>
        <div><b>${rk.icon}</b><small>${rk.name}</small></div>
      </div>
      <div class="bar" style="height:16px;margin-top:12px"><i style="width:${Math.round(rk.progress * 100)}%"></i></div>
      <p style="text-align:center;margin:6px 0 0">${rk.next ? `Ancora ${rk.next.xp - P.xp} XP per diventare ${rk.next.icon} ${rk.next.name}` : 'Hai raggiunto il grado più alto! 👑'}</p>
    </div>
    <div class="panel"><h3>🏆 Trofei (${nTro}/${D.TROPHIES.length})</h3><div class="award-grid">${trophies}</div></div>
    <div class="panel"><h3>🏅 Medaglie (${nMed}/${D.MEDALS.length})</h3><div class="award-grid">${medals}</div></div>
    <div class="panel"><h3>🪜 Gradi</h3><div class="award-grid">${D.RANKS.map((r, i) => `<div class="award ${i <= rk.index ? 'got' : 'locked'}"><span class="ai">${r.icon}</span><b>${r.name}</b><small>${r.xp} XP</small></div>`).join('')}</div></div>`;
}

// ================= Temi =================
function renderThemes() {
  const grid = $('#theme-grid');
  grid.innerHTML = '';
  D.THEMES.forEach((t) => {
    const open = Store.themeUnlocked(P, t);
    const b = document.createElement('button');
    b.className = `theme-btn${open ? '' : ' locked'}${P.theme === t.id ? ' sel' : ''}`;
    b.innerHTML = `<div class="prev" style="background:linear-gradient(160deg,${t.bg.join(',')})"><i style="background:linear-gradient(145deg,${t.back[0]},${t.back[1]})">${t.pattern}</i></div>
      ${open ? '' : `<div class="need">🔒 ⭐ ${t.stars}</div>`}${t.icon} ${t.name}`;
    b.addEventListener('click', () => {
      if (!open) { Audio.play('miss'); toast('🔒', `Servono ${t.stars} stelle`, `Ne hai ${P.stars}: continua a giocare!`); return; }
      P.theme = t.id; persist(); applyTheme(); renderThemes(); Audio.play('unlock'); sparkAt(b);
    });
    grid.appendChild(b);
  });
}

// ================= Statistiche =================
function renderStats() {
  const s = P.stats;
  const acc = s.moves ? Math.round(((s.moves - s.misses) / s.moves) * 100) : 0;
  const favId = Object.entries(s.perCategory).sort((a, b) => b[1] - a[1])[0]?.[0];
  const fav = D.CATEGORIES.find((c) => c.id === favId);
  const mins = Math.round(s.playTime / 60);
  const rows = [];
  const addRows = (mode, list, label) => list.forEach((l) => {
    const k = Store.keyFor(mode, l.n); const r = P.records[k]; const st = P.levelStars[k] ?? 0;
    if (r) rows.push(`<tr><td>${label} ${l.n}</td><td>${'⭐'.repeat(st)}</td><td>${r.score}</td><td>${r.moves}</td><td>${fmtTime(r.time)}</td></tr>`);
  });
  addRows('classic', D.LEVELS, '🃏 Livello');
  addRows('time', D.LEVELS, '⏱️ Livello');
  addRows('relax', D.LEVELS, '🌙 Livello');
  addRows('challenge', D.CHALLENGE_STAGES, '🏔️ Tappa');
  addRows('super', D.SUPER_LEVELS, '🧠 Super');
  $('#stats-body').innerHTML = `
    <div class="panel"><div class="summary">
      <div><b>${s.completed}</b><small>Partite finite</small></div>
      <div><b>${s.pairs}</b><small>Coppie trovate</small></div>
      <div><b>${s.moves}</b><small>Mosse totali</small></div>
      <div><b>${acc}%</b><small>Precisione</small></div>
      <div><b>${s.bestCombo}</b><small>Combo migliore</small></div>
      <div><b>${mins} min</b><small>Tempo di gioco</small></div>
    </div>
    ${fav ? `<p style="text-align:center;margin-top:12px">Categoria preferita: <b>${fav.icon} ${fav.name}</b></p>` : ''}
    </div>
    <div class="panel"><h3>🏅 Record personali</h3>
    ${rows.length ? `<table class="stats-table"><tr><th>Livello</th><th>Stelle</th><th>Punti</th><th>Mosse</th><th>Tempo</th></tr>${rows.join('')}</table>` : '<p>Gioca una partita per vedere i tuoi record! 🎮</p>'}
    </div>`;
}

// ================= Impostazioni =================
function setSetting(k, v) {
  P.settings[k] = v; persist();
  if (k === 'sfx') Audio.setSfx(v);
  if (k === 'music') { Audio.unlock(); Audio.setMusic(v); }
}
function renderSettings() {
  ['sfx', 'music', 'timer', 'haptics'].forEach((k) => { $(`#set-${k}`).checked = !!P.settings[k]; });
  $('#app-version').textContent = VERSION;
}
['sfx', 'music', 'timer', 'haptics'].forEach((k) => {
  $(`#set-${k}`).addEventListener('change', (e) => { setSetting(k, e.target.checked); Audio.play('tap'); });
});

// reset con pressione prolungata (per i genitori)
(() => {
  const btn = $('#btn-reset');
  let t0 = 0; let raf = null;
  const stop = () => { cancelAnimationFrame(raf); raf = null; btn.style.setProperty('--hold', '0%'); };
  const loop = () => {
    const f = (performance.now() - t0) / 3000;
    btn.style.setProperty('--hold', `${Math.min(100, f * 100)}%`);
    if (f >= 1) {
      stop();
      const settings = P.settings;
      P = Store.reset(); P.settings = settings; persist();
      applyTheme(); toast('🧹', 'Progressi azzerati', 'Si ricomincia da capo!');
      return;
    }
    raf = requestAnimationFrame(loop);
  };
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); t0 = performance.now(); raf = requestAnimationFrame(loop); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, stop));
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
})();

// ================= Conferma =================
function confirmDialog(emoji, title, text, onYes, onNo) {
  $('#confirm-emoji').textContent = emoji;
  $('#confirm-title').textContent = title;
  $('#confirm-text').textContent = text;
  const ov = $('#overlay-confirm');
  ov.hidden = false;
  const close = (fn) => { ov.hidden = true; Audio.play('tap'); fn?.(); };
  $('#confirm-yes').onclick = () => close(onYes);
  $('#confirm-no').onclick = () => close(onNo);
}

// ================= Installazione =================
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; if (current === 'install') renderInstall(); });
window.addEventListener('appinstalled', () => { deferredPrompt = null; toast('🎉', 'Memory Kids installato!', 'Lo trovi nella schermata Home'); });

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const shareIcon = '<span class="ios-share"><svg viewBox="0 0 24 24" fill="none" stroke="#1a73e8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 11v9h14v-9"/></svg></span>';

function renderInstall() {
  const body = $('#install-body');
  if (isStandalone()) {
    body.innerHTML = '<div class="panel" style="text-align:center"><div style="font-size:70px">🎉</div><h3>Memory Kids è già installato!</h3><p>Puoi giocare anche senza internet.</p></div>';
    return;
  }
  const ios = `<div class="panel"><h3>🍏 iPhone e iPad</h3><ol class="install-steps">
      <li><span>Apri questa pagina con <b>Safari</b></span></li>
      <li><span>Tocca il pulsante Condividi ${shareIcon} in basso (o in alto su iPad)</span></li>
      <li><span>Scorri e tocca <b>"Aggiungi alla schermata Home"</b> ➕</span></li>
      <li><span>Tocca <b>"Aggiungi"</b>: l'icona di Memory Kids appare sulla Home! 🎉</span></li>
    </ol></div>`;
  const android = `<div class="panel"><h3>🤖 Android</h3>
      ${deferredPrompt ? '<button class="btn btn-play" id="btn-install-now">📲 Installa ora</button>' : ''}
      <ol class="install-steps">
      <li><span>Apri questa pagina con <b>Chrome</b></span></li>
      <li><span>Tocca il menu <b>⋮</b> in alto a destra</span></li>
      <li><span>Tocca <b>"Installa app"</b> oppure <b>"Aggiungi a schermata Home"</b></span></li>
      <li><span>Conferma: Memory Kids sarà tra le tue app! 🎉</span></li>
    </ol></div>`;
  body.innerHTML = (isIOS() ? ios + android : android + ios) +
    '<div class="panel"><h3>✈️ Funziona offline</h3><p>Dopo la prima apertura, Memory Kids funziona anche senza internet. È gratis, senza pubblicità e senza acquisti.</p></div>';
  $('#btn-install-now')?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try { await deferredPrompt.userChoice; } catch (e) { /* */ }
    deferredPrompt = null; renderInstall();
  });
}

// ================= Ciclo di vita =================
function setVh() { document.documentElement.style.setProperty('--vh', `${innerHeight * 0.01}px`); }

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (current === 'game' && game && !game.over && !game.timedOut) pauseGame();
    else if (game && !game.over) saveProgressSnapshot();
    Audio.suspend();
  } else {
    Audio.resume();
  }
});
window.addEventListener('pagehide', () => { if (game && !game.over && current === 'game') saveProgressSnapshot(); });

// prima interazione: sblocca l'audio (obbligatorio su iPhone)
['pointerdown', 'touchend', 'keydown'].forEach((ev) => window.addEventListener(ev, () => Audio.unlock(), { once: true, passive: true }));

$('#btn-start').addEventListener('click', () => {
  Audio.unlock();
  Audio.play('pop');
  splashMascot.act('spin');
  setTimeout(() => show('home'), 200);
});
$('#splash-mascot').addEventListener('click', () => { Audio.unlock(); Audio.play('pop'); splashMascot.mood('happy'); splashMascot.act('jump'); splashMascot.say('Ciao! Sono Stellina! ⭐'); });

// blocca zoom con doppio tocco / gesti su iOS
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

function init() {
  setVh();
  Audio.setSfx(P.settings.sfx);
  Audio.setMusic(P.settings.music);
  applyTheme();
  setTimeout(() => { splashMascot.act('jump'); splashMascot.say('Ciao! Sono Stellina! ⭐', 3000); }, 600);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline non disponibile */ });
  }
  // per i test automatici
  window.__memoryKids = { get game() { return game; }, get progress() { return P; }, startGame, show, VERSION };
}
init();
