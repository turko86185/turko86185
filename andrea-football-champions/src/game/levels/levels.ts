/** Modalità Livelli: 100 livelli in 4 capitoli, difficoltà crescente e dolce. */
export type Objective =
  | 'pass' | 'goal' | 'goal_corner' | 'goal_curve' | 'goal_header' | 'goal_assist'
  | 'beat_defender' | 'long_goal' | 'goals_n' | 'recover';

export interface Scenario {
  attackers: [number, number][]; // [x, z]; il primo ha il pallone (se non c'è looseBall)
  defenders: [number, number][];
  keeper: boolean;
  looseBall?: [number, number];
  highlight?: number; // indice del compagno da evidenziare
}

export interface LevelDef {
  id: number;
  chapter: 1 | 2 | 3 | 4;
  title: string;
  objective: Objective;
  text: string; // obiettivo chiaro per il bambino
  required: number;
  scenarios: Scenario[];
  difficulty: number; // 0 (facilissimo) … 1
  opponentId: string;
  stage?: 'quarti' | 'semifinale' | 'finale';
  hint?: boolean; // mostra la manina che suggerisce il gesto
}

export const CHAPTERS = [
  { id: 1, name: 'Impara a giocare', icon: '🐣', color: '#2ecc71' },
  { id: 2, name: 'Diventa un attaccante', icon: '⚡', color: '#3498db' },
  { id: 3, name: 'Il grande campionato', icon: '🏟️', color: '#e67e22' },
  { id: 4, name: 'La strada verso la Coppa', icon: '🏆', color: '#9b59b6' }
];

const OPP_ORDER = ['como', 'lecce', 'cagliari', 'venezia', 'frosinone', 'monza', 'sassuolo', 'parma', 'genoa', 'udinese', 'torino', 'bologna', 'fiorentina', 'lazio', 'roma', 'atalanta', 'juventus', 'milan', 'napoli', 'inter'];

function rng(seed: number) {
  let s = (seed * 2654435761) % 4294967296;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

// ---------- modelli di scenario ----------
type Gen = (r: () => number, d: number) => Scenario;
const between = (r: () => number, a: number, b: number) => a + (b - a) * r();
const side = (r: () => number) => (r() < 0.5 ? -1 : 1);

const T = {
  shot: ((r, d) => {
    const x = between(r, 33, 39), z = between(r, -9, 9);
    const defs: [number, number][] = d > 0.35 ? [[x + 6, z * 0.5 + between(r, -3, 3)]] : [];
    if (d > 0.6) defs.push([x + 9, -z * 0.3]);
    return { attackers: [[x, z]], defenders: defs, keeper: true };
  }) as Gen,
  passShot: ((r, d) => {
    const s = side(r);
    const a: [number, number] = [between(r, 22, 28), s * between(r, 6, 12)];
    const b: [number, number] = [between(r, 37, 41), -s * between(r, 2, 7)];
    const defs: [number, number][] = [[(a[0] + b[0]) / 2 + 2, (a[1] + b[1]) / 2 + s * between(r, 3, 5)]];
    if (d > 0.45) defs.push([b[0] + 6, b[1] * 0.5]);
    if (d > 0.65) defs.push([a[0] + 8, a[1] - s * 1]);
    return { attackers: [a, b], defenders: defs, keeper: true, highlight: 1 };
  }) as Gen,
  cross: ((r, d) => {
    const s = side(r);
    const a: [number, number] = [between(r, 38, 44), s * between(r, 18, 25)];
    const b: [number, number] = [between(r, 43, 46), -s * between(r, 0, 3)];
    const defs: [number, number][] = [[a[0] + 2, a[1] - s * 6]];
    if (d > 0.5) defs.push([b[0] + 2, b[1] - s * 3]);
    return { attackers: [a, b], defenders: defs, keeper: true, highlight: 1 };
  }) as Gen,
  through: ((r, d) => {
    const s = side(r);
    const a: [number, number] = [between(r, 22, 27), between(r, -3, 3)];
    const b: [number, number] = [between(r, 30, 34), s * between(r, 10, 14)];
    const defs: [number, number][] = [[between(r, 33, 36), s * between(r, 2, 5)]];
    if (d > 0.4) defs.push([42, -s * 4]);
    return { attackers: [a, b], defenders: defs, keeper: true, highlight: 1 };
  }) as Gen,
  combo: ((r, d) => {
    const s = side(r);
    const a: [number, number] = [between(r, 12, 18), between(r, -4, 4)];
    const b: [number, number] = [between(r, 24, 28), s * between(r, 10, 16)];
    const c: [number, number] = [between(r, 35, 40), -s * between(r, 3, 9)];
    const defs: [number, number][] = [[(a[0] + b[0]) / 2 + 1, s * 4], [(b[0] + c[0]) / 2 + 2, 0]];
    if (d > 0.5) defs.push([c[0] + 6, c[1] * 0.4]);
    return { attackers: [a, b, c], defenders: defs, keeper: true, highlight: 1 };
  }) as Gen,
  beat: ((r, d) => {
    const z = between(r, -6, 6);
    const a: [number, number] = [between(r, 27, 31), z];
    const b: [number, number] = [between(r, 40, 43), z + side(r) * between(r, 3, 7)];
    return { attackers: [a, b], defenders: [[a[0] + 6, (a[1] + b[1]) / 2]], keeper: d > 0.25, highlight: 1 };
  }) as Gen,
  long: ((r, d) => {
    const x = between(r, 29, 33), z = between(r, -10, 10);
    const defs: [number, number][] = d > 0.4 ? [[x + 10, -z * 0.4 + side(r) * 4]] : [];
    return { attackers: [[x, z]], defenders: defs, keeper: true };
  }) as Gen,
  recover: ((r, d) => {
    const z = between(r, -6, 6);
    const loose: [number, number] = [between(r, 37, 41), z];
    const defs: [number, number][] = [[loose[0] + 4, z + side(r) * 5]];
    if (d > 0.5) defs.push([loose[0] - 6, z + 8]);
    return { attackers: [[loose[0] - 6, z - 3]], defenders: defs, keeper: true, looseBall: loose };
  }) as Gen
};

const TEXT: Record<Objective, (n: number) => string> = {
  pass: (n) => (n > 1 ? `Fai ${n} passaggi ai compagni!` : 'Fai un passaggio al tuo compagno!'),
  goal: () => 'Segna un gol!',
  goal_corner: () => 'Fai un gol nell\'angolino!',
  goal_curve: () => 'Fai un gol a effetto! Disegna una curva!',
  goal_header: () => 'Fai un cross e segna di testa!',
  goal_assist: () => 'Passa al compagno e fai gol!',
  beat_defender: () => 'Supera il difensore!',
  long_goal: () => 'Segna da fuori area!',
  goals_n: (n) => (n > 1 ? `Segna ${n} gol!` : 'Segna un gol!'),
  recover: () => 'Recupera il pallone e tira!'
};

function chapter1(): LevelDef[] {
  const L: Omit<LevelDef, 'chapter' | 'opponentId'>[] = [
    { id: 1, title: 'Primo passaggio', objective: 'pass', text: 'Fai un passaggio al tuo compagno!', required: 1, difficulty: 0, hint: true,
      scenarios: [{ attackers: [[18, 0], [28, -6]], defenders: [], keeper: false, highlight: 1 }] },
    { id: 2, title: 'Passaggio al compagno', objective: 'pass', text: 'Passa la palla al compagno lontano!', required: 1, difficulty: 0, hint: true,
      scenarios: [{ attackers: [[15, -6], [32, 8]], defenders: [], keeper: false, highlight: 1 }] },
    { id: 3, title: 'Primo tiro', objective: 'goal', text: 'Tira in porta! Disegna verso la porta!', required: 1, difficulty: 0, hint: true,
      scenarios: [{ attackers: [[40, 0]], defenders: [], keeper: false }] },
    { id: 4, title: 'Segna un gol', objective: 'goal', text: 'Segna un gol!', required: 1, difficulty: 0, hint: true,
      scenarios: [{ attackers: [[36, 6]], defenders: [[25, -10]], keeper: false }] },
    { id: 5, title: 'Supera il portiere', objective: 'goal', text: 'C\'è il portiere! Tira lontano da lui!', required: 1, difficulty: 0.02, hint: true,
      scenarios: [{ attackers: [[38, -2]], defenders: [], keeper: true }] },
    { id: 6, title: 'Due passaggi', objective: 'pass', text: 'Fai 2 passaggi ai compagni!', required: 2, difficulty: 0.03,
      scenarios: [{ attackers: [[12, 0], [22, 10], [30, -4]], defenders: [], keeper: false, highlight: 1 }] },
    { id: 7, title: 'Passa e tira', objective: 'goal_assist', text: 'Passa al compagno e fai gol!', required: 1, difficulty: 0.04,
      scenarios: [{ attackers: [[28, 8], [38, -3]], defenders: [], keeper: true, highlight: 1 }] },
    { id: 8, title: 'Tiro dal limite', objective: 'goal', text: 'Segna un gol dal limite dell\'area!', required: 1, difficulty: 0.05,
      scenarios: [{ attackers: [[35, 3]], defenders: [], keeper: true }] },
    { id: 9, title: 'Il primo difensore', objective: 'beat_defender', text: 'Supera il difensore! Passa sopra di lui!', required: 1, difficulty: 0.05, hint: true,
      scenarios: [{ attackers: [[26, 0], [38, 2]], defenders: [[32, 1]], keeper: false, highlight: 1 }] },
    { id: 10, title: 'Prova finale', objective: 'goal_assist', text: 'Passa, evita il difensore e segna!', required: 1, difficulty: 0.08,
      scenarios: [{ attackers: [[24, -8], [37, 4]], defenders: [[31, -3]], keeper: true, highlight: 1 }] }
  ];
  return L.map((l) => ({ ...l, chapter: 1 as const, opponentId: OPP_ORDER[l.id % 5] }));
}

function chapter2(): LevelDef[] {
  const seq: [Objective, keyof typeof T, string][] = [
    ['long_goal', 'long', 'Tiro da lontano'], ['pass', 'through', 'Passaggio in profondità'], ['goal_corner', 'shot', 'Tiro angolato'],
    ['beat_defender', 'beat', 'Supera il difensore'], ['goal_assist', 'passShot', 'Assist vincente'], ['goal_curve', 'shot', 'Tiro a effetto'],
    ['goal_header', 'cross', 'Cross e testa'], ['goal', 'combo', 'Triangolo'], ['goal_corner', 'long', 'Bolide all\'incrocio'], ['goal_assist', 'through', 'Lancio e gol']
  ];
  const out: LevelDef[] = [];
  for (let i = 0; i < 20; i++) {
    const id = 11 + i;
    const [obj, tpl, title] = seq[i % seq.length];
    const d = 0.1 + (i / 19) * 0.25;
    const r = rng(id);
    const scenarios = [0, 1, 2].map(() => T[tpl](r, d));
    if (obj === 'pass') scenarios.forEach((s) => (s.keeper = s.keeper));
    out.push({ id, chapter: 2, title: `${title}${i >= 10 ? ' 2' : ''}`, objective: obj, text: TEXT[obj](1), required: 1, scenarios, difficulty: d, opponentId: OPP_ORDER[i % 10], hint: i < 7 && (obj === 'goal_curve' || obj === 'goal_header') });
  }
  return out;
}

function chapter3(): LevelDef[] {
  const tpls: (keyof typeof T)[] = ['shot', 'passShot', 'through', 'cross', 'beat', 'combo', 'long', 'recover'];
  const out: LevelDef[] = [];
  for (let i = 0; i < 40; i++) {
    const id = 31 + i;
    const d = 0.3 + (i / 39) * 0.25;
    const r = rng(id * 3);
    const opp = OPP_ORDER[i % 20];
    const recover = i % 8 === 5;
    const n = recover ? 1 : 1 + Math.floor(i / 14); // 1..3 gol
    const scenarios: Scenario[] = [];
    for (let k = 0; k < 6; k++) scenarios.push(T[recover ? 'recover' : tpls[(i + k) % tpls.length]](r, d));
    out.push({ id, chapter: 3, title: `Giornata ${i + 1}`, objective: recover ? 'recover' : 'goals_n', text: recover ? TEXT.recover(1) : TEXT.goals_n(n), required: n, scenarios, difficulty: d, opponentId: opp });
  }
  return out;
}

function chapter4(): LevelDef[] {
  const tpls: (keyof typeof T)[] = ['combo', 'passShot', 'cross', 'through', 'shot', 'beat', 'long'];
  const strong = ['inter', 'napoli', 'milan', 'juventus', 'atalanta', 'roma', 'lazio', 'fiorentina', 'bologna', 'como'];
  const out: LevelDef[] = [];
  for (let i = 0; i < 30; i++) {
    const id = 71 + i;
    const d = 0.55 + (i / 29) * 0.2;
    const r = rng(id * 7);
    const stage = id === 98 ? 'quarti' : id === 99 ? 'semifinale' : id === 100 ? 'finale' : undefined;
    const n = stage ? (stage === 'finale' ? 3 : 2) : 2 + (i % 3 === 0 ? 1 : 0) - (i % 4 === 1 ? 1 : 0);
    const scenarios: Scenario[] = [];
    for (let k = 0; k < 8; k++) scenarios.push(T[tpls[(i + k) % tpls.length]](r, d));
    const title = stage === 'quarti' ? 'Quarti di finale' : stage === 'semifinale' ? 'Semifinale' : stage === 'finale' ? 'LA FINALE' : `Partita decisiva ${i + 1}`;
    out.push({ id, chapter: 4, title, objective: 'goals_n', text: stage === 'finale' ? `Vinci la Finale! Segna ${n} gol!` : TEXT.goals_n(n), required: Math.max(1, n), scenarios, difficulty: d, opponentId: stage === 'finale' ? 'inter' : stage === 'semifinale' ? 'napoli' : stage === 'quarti' ? 'milan' : strong[i % strong.length], stage });
  }
  return out;
}

export const LEVELS: LevelDef[] = [...chapter1(), ...chapter2(), ...chapter3(), ...chapter4()];
export const getLevel = (id: number) => LEVELS.find((l) => l.id === id)!;

/** Stelle in base ai tentativi (mai 0: il bambino viene sempre premiato) */
export function starsFor(level: LevelDef, attempts: number): number {
  const base = level.objective === 'goals_n' ? level.required : 1;
  if (attempts <= base) return 3;
  if (attempts <= base + 2) return 2;
  return 1;
}
