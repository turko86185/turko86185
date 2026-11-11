// Audio interamente sintetizzato con Web Audio API: nessun file da scaricare, funziona offline.
import * as Store from './store.js';

let ctx = null, master = null, musicGain = null, sfxGain = null, crowdGain = null;
let crowdNode = null, crowdFilter = null, crowdLevel = 0.25;
let musicTimer = null, musicStep = 0;
let noiseBuf = null;

export function init() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
  musicGain = ctx.createGain(); musicGain.gain.value = 0.22; musicGain.connect(master);
  sfxGain = ctx.createGain(); sfxGain.gain.value = 0.8; sfxGain.connect(master);
  crowdGain = ctx.createGain(); crowdGain.gain.value = 0; crowdGain.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < d.length; i++) { // rumore "rosa" morbido
    const w = Math.random() * 2 - 1;
    b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048;
    d[i] = (b0 + b1 + b2 + w * 0.02) * 0.9;
  }
}

// iOS: sblocca l'audio al primo tocco
export function unlockOnGesture() {
  const f = () => { init(); window.removeEventListener('pointerdown', f); window.removeEventListener('keydown', f); };
  window.addEventListener('pointerdown', f); window.addEventListener('keydown', f);
}

const S = () => Store.settings();

function env(g, t, a, peak, dcy, end = 0.0001) {
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(end, t + a + dcy);
}

function tone(freq, dur, type = 'square', vol = 0.2, when = 0, dest = sfxGain) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  o.connect(g); g.connect(dest);
  env(g, t, 0.01, vol, dur);
  o.start(t); o.stop(t + dur + 0.05);
  return o;
}

function noise(dur, vol, fType, fFreq, when = 0, dest = sfxGain, q = 1) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = fType; f.frequency.value = fFreq; f.Q.value = q;
  const g = ctx.createGain();
  s.connect(f); f.connect(g); g.connect(dest);
  env(g, t, 0.01, vol, dur);
  s.start(t, Math.random()); s.stop(t + dur + 0.1);
}

export function sfx(name, p = 1) {
  if (!ctx || !S().sfx) return;
  switch (name) {
    case 'click': tone(660, 0.08, 'triangle', 0.25); tone(990, 0.1, 'triangle', 0.2, 0.06); break;
    case 'big':   [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'square', 0.12, i * 0.07)); break;
    case 'kick': {
      const t = ctx.currentTime;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(150 + 60 * p, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      o.connect(g); g.connect(sfxGain); env(g, t, 0.003, 0.6 * Math.min(1, 0.4 + p), 0.14);
      o.start(t); o.stop(t + 0.2);
      noise(0.05, 0.25 * p, 'bandpass', 1800, 0, sfxGain, 0.8);
      break;
    }
    case 'bounce': noise(0.04, 0.08 * p, 'lowpass', 500); break;
    case 'post': tone(1250, 0.5, 'triangle', 0.18); tone(1870, 0.35, 'sine', 0.1); break;
    case 'whistle': whistle(0.35); break;
    case 'whistle3': whistle(0.25, 0); whistle(0.25, 0.4); whistle(0.7, 0.8); break;
    case 'whistle2': whistle(0.25, 0); whistle(0.5, 0.35); break;
    case 'net': noise(0.35, 0.25, 'highpass', 2500); break;
    case 'save': noise(0.12, 0.35, 'lowpass', 900); tone(220, 0.1, 'sine', 0.3); break;
    case 'star': [880, 1175, 1568].forEach((f, i) => tone(f, 0.15, 'triangle', 0.15, i * 0.06)); break;
    case 'fail': tone(392, 0.18, 'triangle', 0.15); tone(330, 0.3, 'triangle', 0.15, 0.15); break;
    case 'win': [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.22, 'square', 0.1, i * 0.12)); break;
    case 'pop': tone(500 + Math.random() * 400, 0.06, 'sine', 0.25); break;
  }
}

function whistle(dur, when = 0) {
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.value = 2900;
  lfo.frequency.value = 38; lg.gain.value = 140; lfo.connect(lg); lg.connect(o.frequency);
  o.connect(g); g.connect(sfxGain);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
  g.gain.setValueAtTime(0.18, t + dur - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
}

// ---------- Pubblico ----------
export function crowdStart() {
  if (!ctx || crowdNode) return;
  crowdNode = ctx.createBufferSource(); crowdNode.buffer = noiseBuf; crowdNode.loop = true;
  crowdFilter = ctx.createBiquadFilter(); crowdFilter.type = 'bandpass'; crowdFilter.frequency.value = 700; crowdFilter.Q.value = 0.6;
  crowdNode.connect(crowdFilter); crowdFilter.connect(crowdGain);
  crowdNode.start();
  crowdSet(0.25);
}
export function crowdSet(level, time = 0.6) {
  if (!ctx) return;
  crowdLevel = level;
  const v = S().crowd ? level * 0.5 : 0;
  crowdGain.gain.cancelScheduledValues(ctx.currentTime);
  crowdGain.gain.setTargetAtTime(v, ctx.currentTime, time / 3);
  if (crowdFilter) crowdFilter.frequency.setTargetAtTime(500 + level * 900, ctx.currentTime, 0.2);
}
export function crowdStop() {
  if (!crowdNode) return;
  crowdGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
  const n = crowdNode; crowdNode = null;
  setTimeout(() => { try { n.stop(); } catch (e) {} }, 800);
}
export function cheer(big = true) {
  if (!ctx || !S().crowd) return;
  crowdSet(big ? 1 : 0.6, 0.2);
  setTimeout(() => crowdSet(0.3, 2), big ? 3500 : 1200);
  if (big) chant(2);
}
export function ooh() {
  if (!ctx || !S().crowd) return;
  const t = ctx.currentTime;
  [0, 1, 2].forEach(i => {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(190 + i * 63, t); o.frequency.linearRampToValueAtTime(140 + i * 50, t + 1.1);
    f.type = 'lowpass'; f.frequency.value = 700;
    o.connect(f); f.connect(g); g.connect(crowdGain);
    env(g, t, 0.15, 0.12, 1.0); o.start(t); o.stop(t + 1.3);
  });
}
// coro ritmato: "o-o-o-o" con battimani
export function chant(times = 1) {
  if (!ctx || !S().crowd) return;
  const notes = [392, 392, 440, 392, 523, 494];
  const t0 = ctx.currentTime + 0.1;
  for (let r = 0; r < times; r++) {
    notes.forEach((n, i) => {
      const t = t0 + r * 2.4 + i * 0.36;
      [n, n * 1.005, n / 2].forEach(fr => {
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.value = fr;
        f.type = 'bandpass'; f.frequency.value = 800; f.Q.value = 2;
        o.connect(f); f.connect(g); g.connect(crowdGain);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
        o.start(t); o.stop(t + 0.4);
      });
      if (i % 2 === 1) {
        const s = ctx.createBufferSource(); s.buffer = noiseBuf;
        const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1500;
        const g = ctx.createGain(); s.connect(f); f.connect(g); g.connect(crowdGain);
        g.gain.setValueAtTime(0.0001, t + 0.18); g.gain.exponentialRampToValueAtTime(0.5, t + 0.19);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        s.start(t + 0.18, Math.random()); s.stop(t + 0.35);
      }
    });
  }
}

// ---------- Musica allegra (sequencer) ----------
const MEL = [72, 76, 79, 76, 77, 81, 79, 0, 76, 79, 84, 83, 81, 79, 77, 76,
             74, 77, 81, 77, 79, 83, 81, 0, 79, 77, 76, 74, 72, 74, 76, 0];
const BASS = [48, 48, 55, 55, 53, 53, 55, 55];
const midi = n => 440 * Math.pow(2, (n - 69) / 12);

export function musicStart() {
  if (!ctx || musicTimer) return;
  musicStep = 0;
  let next = ctx.currentTime + 0.1;
  const stepDur = 0.16;
  musicTimer = setInterval(() => {
    if (!S().music) return;
    while (next < ctx.currentTime + 0.3) {
      const s = musicStep % 32;
      const m = MEL[s];
      const when = next - ctx.currentTime;
      if (m) tone(midi(m), stepDur * 0.9, 'square', 0.12, when, musicGain);
      if (s % 4 === 0) tone(midi(BASS[(s / 4) % 8]), stepDur * 3, 'triangle', 0.3, when, musicGain);
      if (s % 4 === 0) kickDrum(when);
      if (s % 4 === 2) noise(0.05, 0.12, 'highpass', 6000, when, musicGain);
      musicStep++; next += stepDur;
    }
  }, 60);
}
function kickDrum(when) {
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.1);
  o.connect(g); g.connect(musicGain); env(g, t, 0.003, 0.5, 0.12);
  o.start(t); o.stop(t + 0.2);
}
export function musicStop() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }

// ---------- Telecronaca (voce sintetica del dispositivo, se disponibile) ----------
let itVoice = null;
function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const vs = speechSynthesis.getVoices();
  itVoice = vs.find(v => /it[-_]IT/i.test(v.lang) && v.localService) || vs.find(v => /^it/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

export function say(text, { rate = 1.05, pitch = 1.15, interrupt = true } = {}) {
  if (!S().voice || !('speechSynthesis' in window)) return;
  try {
    if (interrupt) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'it-IT'; if (itVoice) u.voice = itVoice;
    u.rate = rate; u.pitch = pitch; u.volume = 1;
    speechSynthesis.speak(u);
  } catch (e) {}
}
export function stopVoice() { try { speechSynthesis.cancel(); } catch (e) {} }

export function applySettings() {
  if (!ctx) return;
  if (!S().music) musicGain.gain.value = 0; else musicGain.gain.value = 0.22;
  sfxGain.gain.value = S().sfx ? 0.8 : 0;
  crowdSet(crowdLevel);
  if (!S().voice) stopVoice();
}
export function suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); }
export function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
