// Memory Kids — motore di gioco puro (nessun DOM), testabile in Node.

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Crea un mazzo di `pairs` coppie scegliendo simboli unici da `pool`. */
export function buildDeck(pool, pairs, rng = Math.random) {
  const unique = [...new Set(pool)];
  if (unique.length < pairs) throw new Error(`Servono ${pairs} simboli, disponibili ${unique.length}`);
  const chosen = shuffle(unique, rng).slice(0, pairs);
  return shuffle(chosen.flatMap((sym) => [sym, sym]), rng);
}

export function starsFor(moves, pairs) {
  if (moves <= Math.ceil(pairs * 1.6) + 1) return 3;
  if (moves <= Math.ceil(pairs * 2.4) + 1) return 2;
  return 1; // completare la partita vale sempre almeno 1 stella
}

export class MemoryGame {
  /**
   * @param {string[]} deck  simboli (ogni simbolo esattamente due volte)
   * @param {object} [state] stato salvato per riprendere la partita
   */
  constructor(deck, state = null) {
    this.deck = deck.slice();
    this.matched = new Set(state?.matched ?? []);
    this.moves = state?.moves ?? 0;
    this.misses = state?.misses ?? 0;
    this.combo = 0;
    this.bestCombo = state?.bestCombo ?? 0;
    this.comboBonus = state?.comboBonus ?? 0;
    this.open = []; // indici attualmente scoperti (max 2) e non ancora abbinati
    this.locked = false;
  }

  get pairs() { return this.deck.length / 2; }
  get pairsFound() { return this.matched.size / 2; }
  get finished() { return this.matched.size === this.deck.length; }

  isFaceUp(i) { return this.matched.has(i) || this.open.includes(i); }

  /**
   * Prova a girare la carta i.
   * Ritorna: {type:'ignored'} | {type:'flip', index} | {type:'match', a, b, combo, finished}
   *          | {type:'mismatch', a, b}  (dopo un mismatch il gioco è bloccato finché non si chiama hideMismatch())
   */
  flip(i) {
    if (this.locked || this.finished) return { type: 'ignored', reason: 'locked' };
    if (!Number.isInteger(i) || i < 0 || i >= this.deck.length) return { type: 'ignored', reason: 'range' };
    if (this.matched.has(i) || this.open.includes(i)) return { type: 'ignored', reason: 'faceup' };
    if (this.open.length >= 2) return { type: 'ignored', reason: 'two-open' };

    this.open.push(i);
    if (this.open.length === 1) return { type: 'flip', index: i };

    const [a, b] = this.open;
    this.moves++;
    if (this.deck[a] === this.deck[b]) {
      this.matched.add(a); this.matched.add(b);
      this.open = [];
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      if (this.combo >= 2) this.comboBonus += 25 * (this.combo - 1);
      return { type: 'match', a, b, combo: this.combo, finished: this.finished };
    }
    this.misses++;
    this.combo = 0;
    this.locked = true;
    return { type: 'mismatch', a, b };
  }

  /** Rigira le due carte sbagliate e sblocca il tavolo. */
  hideMismatch() {
    const hidden = this.open.slice();
    this.open = [];
    this.locked = false;
    return hidden;
  }

  /** Punteggio: mai negativo, gli errori non tolgono punti. */
  score({ seconds = 0, timeLeft = 0, timed = false } = {}) {
    const base = this.pairsFound * 100;
    const efficiency = Math.max(0, this.pairs * 2 - this.moves) * 20;
    let timeBonus = 0;
    if (timeLeft > 0) timeBonus = Math.round(timeLeft) * 10;
    else if (timed) timeBonus = Math.max(0, this.pairs * 8 - Math.round(seconds)) * 5;
    return base + efficiency + this.comboBonus + timeBonus;
  }

  serialize() {
    return {
      deck: this.deck,
      matched: [...this.matched],
      moves: this.moves,
      misses: this.misses,
      bestCombo: this.bestCombo,
      comboBonus: this.comboBonus,
    };
  }
}
