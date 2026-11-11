// Gestione squadre: caricamento dal file data/teams.json, divise, stemmi originali.
let DATA = null;

export async function loadTeams() {
  if (DATA) return DATA;
  const r = await fetch('data/teams.json');
  DATA = await r.json();
  return DATA;
}
export const data = () => DATA;
export const teams = () => DATA.teams;
export const team = id => DATA.teams.find(t => t.id === id) || DATA.teams[0];
export const stadiums = () => DATA.stadiums;
export const stadium = id => DATA.stadiums.find(s => s.id === id) || DATA.stadiums[0];
export const specialKits = () => DATA.specialKits;

function hexToRgb(h) {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function colorDist(a, b) {
  const x = hexToRgb(a), y = hexToRgb(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}
function kitDist(k1, k2) {
  return Math.min(colorDist(k1.c1, k2.c1), colorDist(k1.c1, k2.c2) + 60) + colorDist(k1.shorts, k2.shorts) * 0.25;
}

// sceglie le divise evitando che le due squadre abbiano colori troppo simili
export function resolveKits(homeTeam, awayTeam, homeKitChoice = 'home') {
  let hk = homeTeam.home;
  if (homeKitChoice === 'away') hk = homeTeam.away;
  else if (homeKitChoice !== 'home') {
    const sp = DATA.specialKits.find(s => s.id === homeKitChoice);
    if (sp) hk = sp.kit;
  }
  const opts = [awayTeam.home, awayTeam.away];
  let ak = opts[0];
  if (kitDist(hk, opts[0]) < 160 && kitDist(hk, opts[1]) > kitDist(hk, opts[0])) ak = opts[1];
  return [hk, ak];
}

// texture della maglia (canvas) per i diversi motivi
const shirtCache = new Map();
export function shirtCanvas(kit, number = null) {
  const key = JSON.stringify(kit) + '|' + number;
  if (shirtCache.has(key)) return shirtCache.get(key);
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = kit.c1; g.fillRect(0, 0, 256, 128);
  g.fillStyle = kit.c2;
  switch (kit.pattern) {
    case 'stripes': for (let i = 0; i < 256; i += 32) g.fillRect(i + 16, 0, 16, 128); break;
    case 'halves': g.fillRect(64, 0, 128, 128); break;
    case 'hoops': for (let y = 16; y < 128; y += 32) g.fillRect(0, y, 256, 16); break;
    case 'band': g.fillRect(0, 40, 256, 22); break;
    case 'cross': g.fillRect(48, 0, 32, 128); g.fillRect(0, 34, 128, 24); break;
    case 'rainbow': ['#ff4d4d', '#ff9f1c', '#ffe14d', '#4cd18a', '#4d7bff', '#9b5cff'].forEach((col, i) => { g.fillStyle = col; g.fillRect(0, i * 22, 256, 22); }); break;
    case 'stars': for (let i = 0; i < 40; i++) { star(g, (i * 53) % 256, (i * 37) % 128, 4 + (i % 3) * 2); } break;
  }
  // colletto
  g.fillStyle = kit.c2 === kit.c1 ? '#ffffff' : kit.c2;
  g.fillRect(0, 0, 256, 6);
  if (number != null) {
    // numero sul retro (lato della texture che finisce dietro)
    g.font = 'bold 54px Fredoka, Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.55)';
    const bright = luminance(kit.c1) > 0.6;
    g.fillStyle = bright ? '#1a1a1a' : '#ffffff';
    g.strokeStyle = bright ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)';
    g.strokeText(String(number), 192, 70); g.fillText(String(number), 192, 70);
  }
  shirtCache.set(key, c);
  return c;
}
function star(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath(); g.fill();
}
export function luminance(h) {
  const [r, gg, b] = hexToRgb(h);
  return (0.299 * r + 0.587 * gg + 0.114 * b) / 255;
}

// Stemma ORIGINALE disegnato dal gioco (non quello ufficiale, protetto da marchio):
// scudo con i colori sociali e la sigla della squadra.
export function badgeSVG(t, size = 64) {
  const k = t.home;
  const id = 'b' + t.id;
  let stripes = '';
  if (k.pattern === 'stripes') for (let i = 0; i < 5; i++) stripes += `<rect x="${12 + i * 16 + 8}" y="0" width="8" height="100" fill="${k.c2}"/>`;
  else if (k.pattern === 'halves') stripes = `<rect x="50" y="0" width="50" height="100" fill="${k.c2}"/>`;
  else if (k.pattern === 'hoops') stripes = `<rect x="0" y="50" width="100" height="50" fill="${k.c2}"/>`;
  else if (k.pattern === 'cross') stripes = `<rect x="42" y="0" width="16" height="100" fill="${k.c2}"/><rect x="0" y="34" width="100" height="14" fill="${k.c2}"/>`;
  else if (k.pattern === 'band') stripes = `<rect x="0" y="40" width="100" height="16" fill="${k.c2}"/>`;
  else stripes = `<rect x="0" y="62" width="100" height="40" fill="${k.c2}" opacity="0.9"/>`;
  const txtCol = '#ffffff';
  return `<svg class="badge" width="${size}" height="${size}" viewBox="0 0 100 110" aria-hidden="true">
    <defs><clipPath id="${id}"><path d="M10 8 H90 V55 C90 80 70 96 50 104 C30 96 10 80 10 55 Z"/></clipPath></defs>
    <path d="M6 4 H94 V55 C94 84 72 100 50 108 C28 100 6 84 6 55 Z" fill="#1d1d2b"/>
    <g clip-path="url(#${id})"><rect width="100" height="110" fill="${k.c1}"/>${stripes}</g>
    <path d="M10 8 H90 V55 C90 80 70 96 50 104 C30 96 10 80 10 55 Z" fill="none" stroke="#ffffff" stroke-width="3"/>
    <rect x="18" y="38" width="64" height="26" rx="8" fill="rgba(0,0,0,0.55)"/>
    <text x="50" y="57" text-anchor="middle" font-family="Fredoka, Arial, sans-serif" font-weight="700" font-size="20" fill="${txtCol}">${t.short}</text>
  </svg>`;
}

// caratteristiche dei giocatori: generate in modo deterministico dalla forza della squadra
// (si possono anche fornire nel file teams.json con il campo "players")
const ROLES = ['POR', 'DIF', 'DIF', 'CEN', 'CEN', 'ATT'];
const NUMBERS = [1, 3, 5, 8, 7, 9];
export function roster(t, isUser) {
  let seed = [...t.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  return ROLES.map((role, i) => {
    const custom = t.players && t.players[i];
    const base = t.rating / 100;
    const p = {
      role, number: NUMBERS[i],
      name: custom?.name || `${t.short} ${NUMBERS[i]}`,
      speed: custom?.speed ?? clamp(base + (rnd() - 0.5) * 0.2 + (role === 'ATT' ? 0.05 : 0)),
      shot: custom?.shot ?? clamp(base + (rnd() - 0.5) * 0.2 + (role === 'ATT' ? 0.08 : role === 'DIF' ? -0.1 : 0)),
      pass: custom?.pass ?? clamp(base + (rnd() - 0.5) * 0.2 + (role === 'CEN' ? 0.06 : 0)),
      defense: custom?.defense ?? clamp(base + (rnd() - 0.5) * 0.2 + (role === 'DIF' ? 0.08 : 0)),
      skin: ['#f1c7a5', '#e0ac84', '#c68a62', '#8d5a3b', '#f6d5bd', '#6b4128'][Math.floor(rnd() * 6)],
      hair: ['#2b1d12', '#5a3a1e', '#d9b25f', '#111111', '#8a4b22', '#c9c9c9'][Math.floor(rnd() * 6)],
      height: 0.95 + rnd() * 0.12
    };
    if (isUser && role === 'ATT') { p.name = 'ANDREA'; p.number = 10; p.speed = Math.max(p.speed, 0.85); p.shot = Math.max(p.shot, 0.85); }
    return p;
  });
}
const clamp = v => Math.max(0.4, Math.min(0.99, v));
