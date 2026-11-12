// Memory Kids — salvataggio locale dei progressi (solo sul dispositivo, nessun dato personale)
import { LEVELS, SUPER_LEVELS, CHALLENGE_STAGES, CATEGORIES, THEMES, RANKS } from './data.js';

const KEY = 'memorykids.progress.v1';

export function defaultProgress() {
  return {
    version: 1,
    stars: 0,
    xp: 0,
    unlocked: { level: 1, super: 1, challenge: 1 },
    levelStars: {},   // 'classic-3' -> 0..3
    records: {},      // 'classic-3' -> { score, moves, time }
    medals: {},       // id -> timestamp
    trophies: {},     // id -> timestamp
    theme: 'arcobaleno',
    themesSeen: ['arcobaleno'],
    categoriesPlayed: [],
    stats: {
      started: 0, completed: 0, pairs: 0, moves: 0, misses: 0, playTime: 0,
      bestCombo: 0, perMode: {}, perCategory: {},
    },
    settings: { sfx: true, music: true, timer: true, haptics: true },
    lastCategory: 'animali',
    savedGame: null,
  };
}

function merge(base, extra) {
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return extra ?? base;
  const out = { ...base };
  for (const k of Object.keys(extra)) {
    const b = base?.[k];
    out[k] = b && typeof b === 'object' && !Array.isArray(b) ? merge(b, extra[k]) : extra[k];
  }
  return out;
}

let memoryFallback = null;

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return merge(defaultProgress(), JSON.parse(raw));
  } catch (e) { /* storage non disponibile */ }
  return memoryFallback ? merge(defaultProgress(), memoryFallback) : defaultProgress();
}

export function save(p) {
  memoryFallback = JSON.parse(JSON.stringify(p));
  try { localStorage.setItem(KEY, JSON.stringify(p)); return true; } catch (e) { return false; }
}

export function reset() {
  memoryFallback = null;
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  return defaultProgress();
}

export function rankFor(xp) {
  let idx = 0;
  RANKS.forEach((r, i) => { if (xp >= r.xp) idx = i; });
  const cur = RANKS[idx];
  const next = RANKS[idx + 1] ?? null;
  const progress = next ? (xp - cur.xp) / (next.xp - cur.xp) : 1;
  return { index: idx, ...cur, next, progress };
}

export function keyFor(mode, n) {
  return `${mode}-${n}`;
}

/** Il livello n (Classica/Tempo/Relax) è giocabile? */
export function isLevelUnlocked(p, mode, n) {
  if (mode === 'super') return n <= p.unlocked.super;
  if (mode === 'challenge') return n <= p.unlocked.challenge;
  return n <= p.unlocked.level;
}

export function themeUnlocked(p, theme) {
  return p.stars >= theme.stars;
}

/**
 * Registra una partita completata (o terminata col tempo) e calcola premi.
 * result: { mode, n, category, pairs, pairsFound, moves, misses, seconds, stars, score, bestCombo, completed, timeWin }
 * Ritorna { xpGained, starsGained, newMedals[], newTrophies[], newThemes[], unlockedNext, rankUp, record }
 */
export function recordGame(p, r, defs) {
  const out = { xpGained: 0, starsGained: 0, newMedals: [], newTrophies: [], newThemes: [], unlockedNext: null, rankUp: null, record: false };
  const s = p.stats;
  const rankBefore = rankFor(p.xp).index;
  const themesBefore = THEMES.filter((t) => themeUnlocked(p, t)).map((t) => t.id);

  s.pairs += r.pairsFound;
  s.moves += r.moves;
  s.misses += r.misses;
  s.playTime += Math.round(r.seconds);
  s.bestCombo = Math.max(s.bestCombo, r.bestCombo);
  s.perMode[r.mode] = (s.perMode[r.mode] ?? 0) + (r.completed ? 1 : 0);
  if (r.category && r.category !== 'mix') {
    s.perCategory[r.category] = (s.perCategory[r.category] ?? 0) + 1;
    if (!p.categoriesPlayed.includes(r.category)) p.categoriesPlayed.push(r.category);
  }

  // XP: sempre positiva, anche se il tempo è finito
  out.xpGained = r.pairsFound * 10 + (r.completed ? 20 + r.stars * 15 : 5);

  if (r.completed) {
    s.completed++;
    const k = keyFor(r.mode, r.n);
    const prevStars = p.levelStars[k] ?? 0;
    if (r.stars > prevStars) {
      out.starsGained = r.stars - prevStars;
      p.levelStars[k] = r.stars;
    }
    // stelle bonus: ogni partita completata vale almeno 1 stella da collezionare
    if (out.starsGained === 0) out.starsGained = 1;
    p.stars += out.starsGained;

    const rec = p.records[k];
    if (!rec || r.score > rec.score) {
      out.record = !!rec || false;
      p.records[k] = { score: r.score, moves: Math.min(r.moves, rec?.moves ?? Infinity), time: Math.min(Math.round(r.seconds), rec?.time ?? Infinity) };
    } else {
      rec.moves = Math.min(rec.moves, r.moves);
      rec.time = Math.min(rec.time, Math.round(r.seconds));
    }

    // sblocchi
    if (['classic', 'time', 'relax'].includes(r.mode) && r.n === p.unlocked.level && r.n < LEVELS.length) {
      p.unlocked.level = r.n + 1; out.unlockedNext = { mode: r.mode, n: r.n + 1 };
    }
    if (r.mode === 'super' && r.n === p.unlocked.super && r.n < SUPER_LEVELS.length) {
      p.unlocked.super = r.n + 1; out.unlockedNext = { mode: 'super', n: r.n + 1 };
    }
    if (r.mode === 'challenge' && r.n === p.unlocked.challenge && r.n < CHALLENGE_STAGES.length) {
      p.unlocked.challenge = r.n + 1; out.unlockedNext = { mode: 'challenge', n: r.n + 1 };
    }
  }

  p.xp += out.xpGained;

  // temi sbloccati
  out.newThemes = THEMES.filter((t) => themeUnlocked(p, t) && !themesBefore.includes(t.id));

  // medaglie
  const award = (id, cond, bucket = 'medals', list = out.newMedals, all = defs.MEDALS) => {
    if (cond && !p[bucket][id]) {
      p[bucket][id] = Date.now();
      list.push(all.find((m) => m.id === id));
    }
  };
  const challengeDone = p.unlocked.challenge - 1 + (p.levelStars[keyFor('challenge', CHALLENGE_STAGES.length)] ? 1 : 0);
  award('first', s.completed >= 1);
  award('games5', s.completed >= 5);
  award('games25', s.completed >= 25);
  award('games60', s.completed >= 60);
  award('threeStars', r.completed && r.stars === 3);
  award('perfect', r.completed && r.misses === 0 && r.pairs >= 4);
  award('combo3', r.bestCombo >= 3);
  award('combo5', r.bestCombo >= 5);
  award('speedy', r.completed && r.pairs >= 6 && r.seconds < 40);
  award('timeWin', r.mode === 'time' && r.timeWin);
  award('relaxed', r.mode === 'relax' && r.completed);
  award('superOne', r.mode === 'super' && r.completed);
  award('cats6', p.categoriesPlayed.length >= 6);
  award('cats12', p.categoriesPlayed.length >= CATEGORIES.length);
  award('pairs100', s.pairs >= 100);
  award('pairs500', s.pairs >= 500);
  award('challenge6', challengeDone >= 6);
  award('theme', THEMES.filter((t) => themeUnlocked(p, t)).length > 1);

  // trofei
  const T = (id, cond) => award(id, cond, 'trophies', out.newTrophies, defs.TROPHIES);
  const levelsDone = LEVELS.every((l) => ['classic', 'time', 'relax'].some((m) => p.levelStars[keyFor(m, l.n)]));
  T('allLevels', levelsDone);
  T('champion', LEVELS.every((l) => (p.levelStars[keyFor('classic', l.n)] ?? 0) === 3));
  T('summit', !!p.levelStars[keyFor('challenge', CHALLENGE_STAGES.length)]);
  T('superAll', !!p.levelStars[keyFor('super', SUPER_LEVELS.length)]);
  T('stars150', p.stars >= 150);
  T('legend', rankFor(p.xp).index === RANKS.length - 1);

  const rankAfter = rankFor(p.xp);
  if (rankAfter.index > rankBefore) out.rankUp = rankAfter;
  return out;
}
