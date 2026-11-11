// Test del motore di gioco e del salvataggio: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryGame, buildDeck, starsFor } from '../docs/js/engine.js';
import * as D from '../docs/js/data.js';

// localStorage finto per Node
globalThis.localStorage = (() => { let s = {}; return { getItem: (k) => s[k] ?? null, setItem: (k, v) => { s[k] = String(v); }, removeItem: (k) => { delete s[k]; } }; })();
const Store = await import('../docs/js/storage.js');

const pairIndexes = (deck) => {
  const m = {};
  deck.forEach((s, i) => (m[s] ??= []).push(i));
  return Object.values(m);
};

test('ogni categoria ha abbastanza simboli unici per tutti i livelli', () => {
  const maxPairs = Math.max(...D.LEVELS.map((l) => l.cards / 2), ...D.CHALLENGE_STAGES.map((l) => l.cards / 2));
  assert.equal(D.CATEGORIES.length, 12);
  for (const c of D.CATEGORIES) {
    assert.equal(new Set(c.items).size, c.items.length, `duplicati in ${c.id}`);
    assert.ok(c.items.length >= maxPairs, `${c.id} ha solo ${c.items.length} simboli`);
  }
});

test('i livelli richiesti esistono (6, 8, 12, 16, 20 carte) più quelli extra', () => {
  assert.deepEqual(D.LEVELS.slice(0, 5).map((l) => l.cards), [6, 8, 12, 16, 20]);
  assert.ok(D.LEVELS.length > 5);
  for (const l of [...D.LEVELS, ...D.SUPER_LEVELS, ...D.CHALLENGE_STAGES]) assert.equal(l.cards % 2, 0);
});

test('il mazzo contiene esattamente due copie di ogni simbolo', () => {
  for (const cards of [6, 8, 12, 16, 20, 24, 30]) {
    const deck = buildDeck(D.CATEGORIES[0].items, cards / 2);
    assert.equal(deck.length, cards);
    for (const idx of pairIndexes(deck)) assert.equal(idx.length, 2);
  }
});

test('non si possono girare più di due carte', () => {
  const deck = ['A', 'B', 'C', 'A', 'B', 'C'];
  const g = new MemoryGame(deck);
  assert.equal(g.flip(0).type, 'flip');
  assert.equal(g.flip(1).type, 'mismatch');
  assert.equal(g.flip(2).type, 'ignored');
  assert.equal(g.open.length, 2);
  g.hideMismatch();
  assert.equal(g.open.length, 0);
  assert.equal(g.flip(2).type, 'flip');
});

test('non si può girare due volte la stessa carta né una carta già trovata', () => {
  const g = new MemoryGame(['A', 'B', 'A', 'B']);
  g.flip(0);
  assert.equal(g.flip(0).type, 'ignored');
  assert.equal(g.flip(2).type, 'match');
  assert.equal(g.flip(0).type, 'ignored');
  assert.equal(g.flip(2).type, 'ignored');
  assert.equal(g.flip(99).type, 'ignored');
});

test('le coppie trovate restano scoperte e le mosse si contano correttamente', () => {
  const g = new MemoryGame(['A', 'B', 'A', 'B']);
  g.flip(0); g.flip(1); // errore
  assert.equal(g.moves, 1);
  assert.equal(g.isFaceUp(0), true);
  g.hideMismatch();
  assert.equal(g.isFaceUp(0), false);
  g.flip(0); const r = g.flip(2);
  assert.equal(r.type, 'match');
  assert.equal(g.moves, 2);
  assert.ok(g.isFaceUp(0) && g.isFaceUp(2));
  g.flip(1); const r2 = g.flip(3);
  assert.equal(r2.finished, true);
  assert.equal(g.moves, 3);
  assert.equal(g.misses, 1);
  assert.ok(g.finished);
  assert.equal(g.flip(1).type, 'ignored');
});

test('partita perfetta = 3 stelle, completare vale sempre almeno 1 stella', () => {
  assert.equal(starsFor(3, 3), 3);
  assert.equal(starsFor(10, 10), 3);
  assert.equal(starsFor(999, 10), 1);
});

test('il punteggio non è mai negativo', () => {
  const g = new MemoryGame(['A', 'B', 'A', 'B']);
  for (let k = 0; k < 50; k++) { g.flip(0); g.flip(1); g.hideMismatch(); }
  assert.ok(g.score() >= 0);
});

test('stato serializzato permette di riprendere la partita', () => {
  const g = new MemoryGame(['A', 'B', 'A', 'B']);
  g.flip(0); g.flip(2);
  const g2 = new MemoryGame(g.serialize().deck, g.serialize());
  assert.equal(g2.pairsFound, 1);
  assert.equal(g2.moves, 1);
  assert.ok(g2.isFaceUp(0));
});

test('completare un livello sblocca il successivo e salva i progressi', () => {
  let p = Store.reset();
  assert.equal(Store.isLevelUnlocked(p, 'classic', 2), false);
  const out = Store.recordGame(p, { mode: 'classic', n: 1, category: 'animali', pairs: 3, pairsFound: 3, moves: 3, misses: 0, seconds: 10, stars: 3, score: 500, bestCombo: 3, completed: true, timeWin: false }, D);
  assert.equal(Store.isLevelUnlocked(p, 'classic', 2), true);
  assert.equal(Store.isLevelUnlocked(p, 'time', 2), true);
  assert.equal(Store.isLevelUnlocked(p, 'classic', 3), false);
  assert.deepEqual(out.unlockedNext, { mode: 'classic', n: 2 });
  assert.ok(out.newMedals.some((m) => m.id === 'first'));
  assert.equal(p.stars, 3);
  Store.save(p);
  p = Store.load();
  assert.equal(p.unlocked.level, 2);
  assert.equal(p.levelStars['classic-1'], 3);
  assert.ok(p.medals.first);
});

test('le partite non finite danno comunque XP e non tolgono nulla', () => {
  const p = Store.reset();
  const out = Store.recordGame(p, { mode: 'time', n: 1, category: 'animali', pairs: 3, pairsFound: 1, moves: 8, misses: 7, seconds: 41, stars: 0, score: 0, bestCombo: 1, completed: false, timeWin: false }, D);
  assert.ok(out.xpGained > 0);
  assert.equal(p.stars, 0);
  assert.equal(p.unlocked.level, 1);
});

test('Sfida e Super Memory si sbloccano separatamente', () => {
  const p = Store.reset();
  Store.recordGame(p, { mode: 'challenge', n: 1, category: 'animali', pairs: 3, pairsFound: 3, moves: 4, misses: 1, seconds: 20, stars: 3, score: 400, bestCombo: 2, completed: true }, D);
  assert.equal(p.unlocked.challenge, 2);
  assert.equal(p.unlocked.level, 1);
  Store.recordGame(p, { mode: 'super', n: 1, category: 'mix', pairs: 12, pairsFound: 12, moves: 30, misses: 18, seconds: 200, stars: 1, score: 1500, bestCombo: 2, completed: true }, D);
  assert.equal(p.unlocked.super, 2);
});
