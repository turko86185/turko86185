// Memory Kids — effetti sonori e musica generati al volo con Web Audio (nessun file, funziona offline)

let ctx = null;
let master = null;
let sfxGain = null;
let musicGain = null;
let sfxOn = true;
let musicOn = true;
let musicTimer = null;
let musicStyle = 'happy';
let nextNoteTime = 0;
let step = 0;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
  sfxGain = ctx.createGain(); sfxGain.gain.value = 0.55; sfxGain.connect(master);
  musicGain = ctx.createGain(); musicGain.gain.value = 0.0; musicGain.connect(master);
  return ctx;
}

/** Da chiamare dopo un tocco dell'utente (richiesto da iPhone/Android). */
export function unlock() {
  const c = ensure();
  if (!c) return;
  if (c.state === 'suspended') c.resume().then(() => { if (musicOn) startMusic(); });
  // iOS: suono silenzioso per sbloccare
  const b = c.createBuffer(1, 1, 22050);
  const s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0);
  if (musicOn && !musicTimer) startMusic();
}

export function setSfx(on) { sfxOn = on; }
export function setMusic(on) {
  musicOn = on;
  if (on) startMusic(); else stopMusic();
}

function tone(freq, start, dur, { type = 'sine', vol = 0.3, attack = 0.01, slideTo = null, dest = sfxGain } = {}) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g); g.connect(dest);
  o.start(start); o.stop(start + dur + 0.05);
}

const N = (semi) => 440 * Math.pow(2, (semi - 9) / 12); // semitoni da Do4 (C4 = 0)

export function play(name) {
  if (!sfxOn) return;
  const c = ensure();
  if (!c || c.state !== 'running') return;
  const t = c.currentTime + 0.01;
  switch (name) {
    case 'flip':
      tone(520, t, 0.09, { type: 'triangle', vol: 0.25, slideTo: 880 });
      break;
    case 'tap':
      tone(660, t, 0.07, { type: 'sine', vol: 0.22, slideTo: 990 });
      break;
    case 'match':
      [12, 16, 19, 24].forEach((s, i) => tone(N(s), t + i * 0.07, 0.22, { type: 'triangle', vol: 0.28 }));
      tone(N(36), t + 0.28, 0.3, { type: 'sine', vol: 0.12 });
      break;
    case 'miss': // morbido, mai "negativo"
      tone(N(7), t, 0.16, { type: 'sine', vol: 0.18 });
      tone(N(4), t + 0.12, 0.2, { type: 'sine', vol: 0.16 });
      break;
    case 'star':
      tone(N(24), t, 0.25, { type: 'sine', vol: 0.25 });
      tone(N(31), t + 0.06, 0.3, { type: 'triangle', vol: 0.16 });
      break;
    case 'unlock':
      for (let i = 0; i < 8; i++) tone(N(12 + i * 2), t + i * 0.04, 0.18, { type: 'sine', vol: 0.15 });
      break;
    case 'win': {
      const mel = [[0, 0.12], [4, 0.12], [7, 0.12], [12, 0.3], [7, 0.12], [12, 0.6]];
      let tt = t;
      mel.forEach(([s, d]) => { tone(N(s + 12), tt, d + 0.1, { type: 'triangle', vol: 0.3 }); tone(N(s), tt, d + 0.1, { type: 'sine', vol: 0.12 }); tt += d; });
      [24, 28, 31, 36].forEach((s, i) => tone(N(s), tt + i * 0.05, 0.5, { type: 'sine', vol: 0.08 }));
      break;
    }
    case 'tick':
      tone(1200, t, 0.04, { type: 'sine', vol: 0.08 });
      break;
    case 'pop':
      tone(300, t, 0.12, { type: 'sine', vol: 0.3, slideTo: 900 });
      break;
    default: break;
  }
}

// ---- Musica di sottofondo originale (melodia pentatonica allegra) ----
// Ogni battuta: [nota melodia (semitoni o null), ...] in crome, basso sul primo tempo
const SONGS = {
  happy: {
    bpm: 112,
    melody: [
      12, 16, 19, 16, 21, 19, 16, null,
      14, 16, 19, 21, 19, 16, 14, null,
      12, 16, 19, 24, 21, 19, 16, 19,
      21, 19, 16, 14, 12, null, 12, null,
      16, 19, 21, 24, 21, 19, 21, null,
      19, 16, 14, 16, 19, 16, 12, null,
      9, 12, 14, 16, 19, 16, 14, 12,
      14, 16, 12, null, 12, null, null, null,
    ],
    bass: [0, -3, 5, 7, 0, -3, 5, 0],
    lead: 'triangle', vol: 0.07,
  },
  calm: {
    bpm: 76,
    melody: [
      16, null, 19, null, 21, null, 19, 16,
      14, null, 16, null, 12, null, null, null,
      16, null, 19, null, 24, null, 21, 19,
      21, null, 19, null, 16, null, null, null,
    ],
    bass: [0, -3, 5, 0],
    lead: 'sine', vol: 0.06,
  },
};

export function setMusicStyle(style) {
  if (style === musicStyle) return;
  musicStyle = style;
  step = 0;
}

function scheduler() {
  if (!ctx) return;
  const song = SONGS[musicStyle];
  const eighth = 60 / song.bpm / 2;
  while (nextNoteTime < ctx.currentTime + 0.25) {
    const idx = step % song.melody.length;
    const note = song.melody[idx];
    if (note !== null) tone(N(note), nextNoteTime, eighth * 1.6, { type: song.lead, vol: song.vol, attack: 0.02, dest: musicGain });
    if (idx % 8 === 0) {
      const bar = Math.floor(idx / 8) % song.bass.length;
      tone(N(song.bass[bar] - 12), nextNoteTime, eighth * 7, { type: 'sine', vol: 0.08, attack: 0.05, dest: musicGain });
      tone(N(song.bass[bar] + 4 - 12), nextNoteTime + eighth * 4, eighth * 3, { type: 'sine', vol: 0.04, attack: 0.05, dest: musicGain });
    }
    // piccolo "shaker" leggero
    if (musicStyle === 'happy' && idx % 2 === 1) tone(5000, nextNoteTime, 0.03, { type: 'square', vol: 0.004, dest: musicGain });
    nextNoteTime += eighth;
    step++;
  }
}

export function startMusic() {
  if (!musicOn) return;
  const c = ensure();
  if (!c || c.state !== 'running' || musicTimer) return;
  nextNoteTime = c.currentTime + 0.1;
  musicGain.gain.cancelScheduledValues(c.currentTime);
  musicGain.gain.setValueAtTime(0.0001, c.currentTime);
  musicGain.gain.exponentialRampToValueAtTime(1, c.currentTime + 1.5);
  musicTimer = setInterval(scheduler, 100);
}

export function stopMusic() {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  if (ctx && musicGain) {
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setValueAtTime(musicGain.gain.value, ctx.currentTime);
    musicGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
  }
}

/** Sospende l'audio quando l'app va in background. */
export function suspend() { stopMusic(); if (ctx && ctx.state === 'running') ctx.suspend(); }
export function resume() {
  if (!ctx) return;
  ctx.resume().then(() => { if (musicOn) startMusic(); });
}
