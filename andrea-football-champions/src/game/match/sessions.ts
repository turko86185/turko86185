import { getTeam, SPECIAL_KITS, TEAMS, type Kit, type Team } from '../teams/teams';
import { starsFor, type LevelDef, type Scenario } from '../levels/levels';
import type { MatchConfig, Outcome } from './Match';
import type { TableRow, ChampionshipState, Difficulty } from '../save/SaveManager';
import { GOAL, FIELD } from '../physics/constants';

export interface SessionResult {
  done: boolean;
  success?: boolean;
  stars?: number;
  title?: string; // messaggio grande
  subtitle?: string;
  interlude?: string; // messaggio tra un'azione e l'altra
}

export interface HudInfo { objective: string; left?: string; right?: string; scoreHome?: number; scoreAway?: number; homeShort?: string; awayShort?: string; progress?: string }

export interface Session {
  kind: 'level' | 'quick' | 'penalties' | 'training' | 'championship';
  nextConfig(): MatchConfig;
  onOutcome(o: Outcome): SessionResult;
  onPass?(count: number, beatDefender: boolean): SessionResult | null;
  hud(): HudInfo;
  homeTeam: Team;
  awayTeam: Team;
}

export function attackKitFor(teamId: string, kitId: string, _oppId: string): Kit {
  if (SPECIAL_KITS[kitId]) return SPECIAL_KITS[kitId];
  const t = getTeam(teamId);
  return kitId === 'trasferta' ? t.away : t.home;
}

function kitsPair(teamId: string, kitId: string, oppId: string) {
  const att = attackKitFor(teamId, kitId, oppId);
  const opp = getTeam(oppId);
  const def = colorClose(att.primary, opp.home.primary) ? opp.away : opp.home;
  return { att, def };
}

function colorClose(a: string, b: string) {
  const p = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 130;
}

const PRAISE = ['BRAVISSIMO ANDREA!', 'CHE GOL INCREDIBILE!', 'SEI UN CAMPIONE!', 'FANTASTICO ANDREA!', 'GOL SPETTACOLARE!'];
export const praise = () => PRAISE[Math.floor(Math.random() * PRAISE.length)];

function pickOpponent(teamId: string, wanted: string): string {
  if (wanted !== teamId) return wanted;
  return TEAMS.find((t) => t.id !== teamId)!.id;
}

// ----------------------------------------------------------------- LIVELLI
export class LevelSession implements Session {
  kind = 'level' as const;
  attempts = 0;
  goals = 0;
  private scenarioIdx = 0;
  homeTeam: Team; awayTeam: Team;
  private kits: { att: Kit; def: Kit };

  constructor(public level: LevelDef, teamId: string, kitId: string) {
    this.homeTeam = getTeam(teamId);
    this.awayTeam = getTeam(pickOpponent(teamId, level.opponentId));
    this.kits = kitsPair(teamId, kitId, this.awayTeam.id);
  }

  nextConfig(): MatchConfig {
    const sc = this.level.scenarios[this.scenarioIdx % this.level.scenarios.length];
    const d = this.level.difficulty;
    return {
      scenario: sc, attackKit: this.kits.att, defendKit: this.kits.def, attackKeeperKit: this.homeTeam.keeperKit, defendKeeperKit: this.awayTeam.keeperKit,
      difficulty: d * 0.85, assist: Math.max(0.35, 1 - d * 0.8), mode: 'normal', hint: this.level.hint && this.attempts < 3,
      playerNames: [this.homeTeam.players.fw[0], this.homeTeam.players.fw[1], this.homeTeam.players.mf[0]]
    };
  }

  private win(): SessionResult {
    const stars = starsFor(this.level, this.attempts);
    const final = this.level.stage === 'finale';
    return { done: true, success: true, stars, title: final ? 'HAI VINTO LA COPPA!' : praise(), subtitle: `Livello ${this.level.id} completato!` };
  }

  onPass(count: number, beat: boolean): SessionResult | null {
    const o = this.level.objective;
    if (o === 'pass' && count >= this.level.required) { this.attempts++; return this.win(); }
    if (o === 'beat_defender' && beat) { this.attempts++; return this.win(); }
    return null;
  }

  onOutcome(oc: Outcome): SessionResult {
    const o = this.level.objective;
    this.attempts++;
    const lenient = this.attempts >= 5; // dopo qualche tentativo basta un gol qualsiasi
    if (oc.kind === 'goal') {
      this.goals++;
      const ok =
        o === 'goal' || o === 'recover' || o === 'goals_n' || lenient ||
        (o === 'goal_corner' && oc.corner) || (o === 'goal_curve' && oc.curve) || (o === 'goal_header' && oc.header) ||
        (o === 'goal_assist' && oc.passes > 0) || (o === 'beat_defender') || (o === 'long_goal' && oc.long) || (o === 'pass' && oc.passes >= this.level.required);
      if (o === 'goals_n') {
        if (this.goals >= this.level.required) return this.win();
        this.scenarioIdx++;
        return { done: false, interlude: `GOL! Ne mancano ${this.level.required - this.goals}!` };
      }
      if (ok) return this.win();
      this.scenarioIdx++;
      const tip: Record<string, string> = {
        goal_corner: 'Bel gol! Ora prova nell\'angolino, vicino al palo!',
        goal_curve: 'Bel gol! Ora disegna una curva per il tiro a effetto!',
        goal_header: 'Bel gol! Ora fai un cross dal lato al compagno in area!',
        goal_assist: 'Bel gol! Ora prima passa al compagno!',
        long_goal: 'Bel gol! Ora prova a tirare da più lontano!'
      };
      return { done: false, interlude: tip[o] ?? 'Bel gol! Riprova!' };
    }
    this.scenarioIdx++;
    const msg: Record<string, string> = {
      saved: 'Che parata! Riprova, tira lontano dal portiere!',
      intercepted: 'Il difensore ha preso la palla! Riprova!',
      miss: 'Quasi! Riprova!',
      lost: 'Palla persa! Riprova!'
    };
    return { done: false, interlude: msg[oc.kind] };
  }

  hud(): HudInfo {
    const o = this.level.objective;
    return {
      objective: this.level.text,
      progress: o === 'goals_n' ? `⚽ ${this.goals}/${this.level.required}` : undefined,
      left: `Livello ${this.level.id}`,
      right: `Tentativo ${this.attempts + 1}`,
      homeShort: this.homeTeam.short, awayShort: this.awayTeam.short
    };
  }
}

// ----------------------------------------------------- SCENARI CASUALI PER LE PARTITE
export function randomAttack(rnd = Math.random, d = 0.3): Scenario {
  const s = rnd() < 0.5 ? -1 : 1;
  const kind = Math.floor(rnd() * 5);
  switch (kind) {
    case 0: return { attackers: [[34 + rnd() * 5, (rnd() - 0.5) * 16]], defenders: d > 0.3 ? [[44, (rnd() - 0.5) * 8]] : [], keeper: true };
    case 1: return { attackers: [[24, s * 9], [38, -s * 4]], defenders: [[32, s * 2]], keeper: true, highlight: 1 };
    case 2: return { attackers: [[40, s * 22], [45, -s * 1.5]], defenders: [[42, s * 15]], keeper: true, highlight: 1 };
    case 3: return { attackers: [[18, 0], [27, s * 13], [37, -s * 6]], defenders: [[25, s * 4], [34, 0]], keeper: true, highlight: 1 };
    default: return { attackers: [[26, s * 3], [32, s * 12]], defenders: [[33, s * 3]], keeper: true, highlight: 1 };
  }
}

/** Simula un attacco avversario (risultato testuale, divertente ma raro) */
export function simulateOpponentAttack(home: Team, away: Team, rnd = Math.random): { goal: boolean; text: string } {
  const p = OPP_BOOST[currentLevel] + Math.max(0, away.strength - 2) * 0.04;
  const goal = rnd() < p;
  const name = away.players.fw[Math.floor(rnd() * 3)];
  if (goal) return { goal, text: `Attacco ${away.name}... gol di ${name}. Non mollare Andrea!` };
  const saves = [`Attacco ${away.name}... PARATA del tuo portiere ${home.players.gk}!`, `Tiro di ${name}... FUORI!`, `${away.name} ci prova... il tuo difensore ${home.players.df[0]} ruba palla!`];
  return { goal, text: saves[Math.floor(rnd() * saves.length)] };
}

// ----------------------------------------------------------- PARTITA VELOCE / CAMPIONATO
export class QuickMatchSession implements Session {
  kind: 'quick' | 'championship' = 'quick';
  attack = 0;
  gf = 0; ga = 0;
  homeTeam: Team; awayTeam: Team;
  private kits: { att: Kit; def: Kit };
  private scenarios: Scenario[];

  constructor(teamId: string, oppId: string, kitId: string, public attacks = 5, public difficulty = 0.3) {
    this.homeTeam = getTeam(teamId);
    this.awayTeam = getTeam(pickOpponent(teamId, oppId));
    this.kits = kitsPair(teamId, kitId, this.awayTeam.id);
    this.scenarios = Array.from({ length: attacks }, () => randomAttack(Math.random, difficulty));
  }

  nextConfig(): MatchConfig {
    return {
      scenario: this.scenarios[this.attack % this.scenarios.length], attackKit: this.kits.att, defendKit: this.kits.def,
      attackKeeperKit: this.homeTeam.keeperKit, defendKeeperKit: this.awayTeam.keeperKit,
      difficulty: this.difficulty * (0.7 + this.awayTeam.strength * 0.08), assist: Math.max(0.4, 0.9 - this.difficulty * 0.6), mode: 'normal'
    };
  }

  onOutcome(o: Outcome): SessionResult {
    this.attack++;
    if (o.kind === 'goal') this.gf++;
    const opp = simulateOpponentAttack(this.homeTeam, this.awayTeam);
    if (opp.goal) this.ga++;
    const head = o.kind === 'goal' ? `${praise()} ` : '';
    if (this.attack >= this.attacks) {
      const res = this.gf > this.ga ? 'HAI VINTO!' : this.gf === this.ga ? 'PAREGGIO!' : 'Partita persa... ma hai giocato benissimo!';
      return { done: true, success: this.gf >= this.ga, title: res, subtitle: `${this.homeTeam.name} ${this.gf} - ${this.ga} ${this.awayTeam.name}`, interlude: opp.text };
    }
    return { done: false, interlude: `${head}${opp.text}` };
  }

  hud(): HudInfo {
    return { objective: `Attacco ${Math.min(this.attack + 1, this.attacks)} di ${this.attacks}`, scoreHome: this.gf, scoreAway: this.ga, homeShort: this.homeTeam.short, awayShort: this.awayTeam.short };
  }
}

// --------------------------------------------------------------------- RIGORI
export class PenaltySession implements Session {
  kind = 'penalties' as const;
  round = 0; // ogni round: Andrea tira, poi l'avversario
  turn: 'shoot' | 'save' = 'shoot';
  homeGoals = 0; awayGoals = 0;
  homeKicks: boolean[] = []; awayKicks: boolean[] = [];
  homeTeam: Team; awayTeam: Team;
  private kits: { att: Kit; def: Kit };
  constructor(teamId: string, oppId: string, kitId: string) {
    this.homeTeam = getTeam(teamId);
    this.awayTeam = getTeam(pickOpponent(teamId, oppId));
    this.kits = kitsPair(teamId, kitId, this.awayTeam.id);
  }
  nextConfig(): MatchConfig {
    const spot: [number, number] = [GOAL.x - FIELD.penaltySpot, 0];
    if (this.turn === 'shoot') {
      return { scenario: { attackers: [spot], defenders: [], keeper: true }, attackKit: this.kits.att, defendKit: this.kits.def,
        attackKeeperKit: this.homeTeam.keeperKit, defendKeeperKit: this.awayTeam.keeperKit, difficulty: 0.3, assist: 0.8, mode: 'penalty' };
    }
    return { scenario: { attackers: [spot], defenders: [], keeper: true }, attackKit: this.kits.def, defendKit: this.kits.att,
      attackKeeperKit: this.awayTeam.keeperKit, defendKeeperKit: this.homeTeam.keeperKit, difficulty: 0.3, assist: 0.5, mode: 'penaltyDefend' };
  }
  private decided(): boolean {
    const n = Math.max(5, this.round);
    const hLeft = Math.max(0, 5 - this.homeKicks.length), aLeft = Math.max(0, 5 - this.awayKicks.length);
    if (this.homeKicks.length <= 5 && this.awayKicks.length <= 5) {
      if (this.homeGoals > this.awayGoals + aLeft) return true;
      if (this.awayGoals > this.homeGoals + hLeft) return true;
    }
    if (this.homeKicks.length >= 5 && this.homeKicks.length === this.awayKicks.length && this.homeGoals !== this.awayGoals) return true;
    void n;
    return this.homeKicks.length >= 10 && this.homeKicks.length === this.awayKicks.length;
  }
  onOutcome(o: Outcome): SessionResult {
    if (this.turn === 'shoot') {
      const g = o.kind === 'goal';
      this.homeKicks.push(g); if (g) this.homeGoals++;
      this.turn = 'save';
      if (this.decided()) return this.final();
      return { done: false, interlude: g ? `${praise()} Ora sei il portiere: scegli dove tuffarti!` : 'Peccato! Ora sei il portiere: scegli dove tuffarti!' };
    }
    const g = o.kind === 'goal';
    this.awayKicks.push(g); if (g) this.awayGoals++;
    this.turn = 'shoot';
    this.round++;
    if (this.decided()) return this.final();
    return { done: false, interlude: g ? 'Gol dell\'avversario. Ora tocca a te tirare!' : 'GRANDE PARATA ANDREA! Ora tocca a te tirare!' };
  }
  private final(): SessionResult {
    const win = this.homeGoals > this.awayGoals;
    return { done: true, success: win, title: win ? 'HAI VINTO AI RIGORI!' : 'Hanno vinto loro... la prossima volta vinci tu!', subtitle: `${this.homeTeam.name} ${this.homeGoals} - ${this.awayGoals} ${this.awayTeam.name}` };
  }
  hud(): HudInfo {
    return { objective: this.turn === 'shoot' ? 'Disegna il tiro e segna il rigore!' : 'Sei il portiere! Tocca dove tuffarti!', scoreHome: this.homeGoals, scoreAway: this.awayGoals, homeShort: this.homeTeam.short, awayShort: this.awayTeam.short,
      progress: this.homeKicks.length ? `Tu: ${this.homeKicks.map((k) => (k ? '🟢' : '🔴')).join('')}  Loro: ${this.awayKicks.map((k) => (k ? '🟢' : '🔴')).join('')}` : undefined };
  }
}

// ----------------------------------------------------------------- ALLENAMENTO
export type Drill = 'tiro' | 'passaggi' | 'precisione';
export class TrainingSession implements Session {
  kind = 'training' as const;
  points = 0;
  shots = 0;
  homeTeam: Team; awayTeam: Team;
  private targets: { y: number; z: number; r: number }[] = [];
  constructor(teamId: string, kitId: string, public drill: Drill) {
    this.homeTeam = getTeam(teamId);
    this.awayTeam = getTeam(TEAMS.find((t) => t.id !== teamId)!.id);
    this.kit = attackKitFor(teamId, kitId, this.awayTeam.id);
  }
  private kit: Kit;
  nextConfig(): MatchConfig {
    const r = Math.random;
    let scenario: Scenario;
    if (this.drill === 'passaggi') {
      const s = r() < 0.5 ? -1 : 1;
      scenario = { attackers: [[10 + r() * 10, (r() - 0.5) * 10], [24 + r() * 8, s * (6 + r() * 12)], [30 + r() * 8, -s * (4 + r() * 10)]], defenders: [[24, 0]], keeper: false, highlight: 1 };
      this.targets = [];
    } else {
      scenario = { attackers: [[32 + r() * 8, (r() - 0.5) * 18]], defenders: [], keeper: this.drill === 'precisione' };
      this.targets = [
        { y: 0.6 + r() * 1.4, z: -2.4 - r() * 0.6, r: 0.6 },
        { y: 0.6 + r() * 1.4, z: 2.4 + r() * 0.6, r: 0.6 },
        { y: 1.9, z: (r() - 0.5) * 2, r: 0.5 }
      ];
    }
    return { scenario, attackKit: this.kit, defendKit: SPECIAL_KITS.galassia, attackKeeperKit: this.homeTeam.keeperKit, defendKeeperKit: this.awayTeam.keeperKit,
      difficulty: this.drill === 'precisione' ? 0.3 : 0.1, assist: 0.6, mode: 'training', targets: this.targets.length ? this.targets : undefined };
  }
  onPass(count: number): SessionResult | null {
    if (this.drill !== 'passaggi') return null;
    this.points++;
    if (count >= 2) return { done: false, interlude: 'Due passaggi! Super!' };
    return null;
  }
  onOutcome(o: Outcome): SessionResult {
    this.shots++;
    let msg = 'Riprova!';
    if (o.kind === 'goal') {
      if (this.drill === 'passaggi') { this.points += 1; msg = 'Gol! +1'; }
      else if (o.targetHit !== undefined) { this.points += 3; msg = 'CENTRO! +3 punti!'; }
      else { this.points += 1; msg = 'Gol! +1 punto'; }
    }
    return { done: false, interlude: `${msg}  Punti: ${this.points}` };
  }
  hud(): HudInfo {
    const t = { tiro: 'Colpisci i cerchi nella porta!', passaggi: 'Passa la palla ai compagni!', precisione: 'Centra i cerchi e batti il portiere!' };
    return { objective: t[this.drill], left: 'Allenamento', right: `Punti: ${this.points}` };
  }
}

// --------------------------------------------------------------------- CAMPIONATO
export const CHAMP_ROUNDS = 19;

export function newChampionship(teamId: string): ChampionshipState {
  const opps = TEAMS.filter((t) => t.id !== teamId).map((t) => t.id).sort((a, b) => getTeam(a).strength - getTeam(b).strength);
  const table: Record<string, TableRow> = {};
  for (const t of TEAMS) table[t.id] = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  return { teamId, round: 0, opponents: opps, table, results: [], finished: false };
}

function applyResult(tb: Record<string, TableRow>, h: string, a: string, gh: number, ga: number) {
  const H = tb[h], A = tb[a];
  H.p++; A.p++; H.gf += gh; H.ga += ga; A.gf += ga; A.ga += gh;
  if (gh > ga) { H.w++; H.pts += 3; A.l++; } else if (gh < ga) { A.w++; A.pts += 3; H.l++; } else { H.d++; A.d++; H.pts++; A.pts++; }
}

function poisson(lambda: number, rnd = Math.random) {
  let L = Math.exp(-lambda), k = 0, p = 1;
  do { k++; p *= rnd(); } while (p > L);
  return k - 1;
}

/** Registra la giornata: risultato di Andrea + simulazione delle altre partite */
export function recordRound(st: ChampionshipState, gf: number, ga: number, rnd = Math.random): ChampionshipState {
  const opp = st.opponents[st.round];
  applyResult(st.table, st.teamId, opp, gf, ga);
  st.results.push({ opp, gf, ga });
  const others = TEAMS.map((t) => t.id).filter((id) => id !== st.teamId && id !== opp);
  // abbinamenti casuali delle altre 18 squadre
  const shuffled = others.slice().sort(() => rnd() - 0.5);
  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    const h = getTeam(shuffled[i]), a = getTeam(shuffled[i + 1]);
    applyResult(st.table, h.id, a.id, poisson(0.9 + h.strength * 0.2, rnd), poisson(0.7 + a.strength * 0.2, rnd));
  }
  st.round++;
  if (st.round >= CHAMP_ROUNDS) st.finished = true;
  return st;
}

export function standings(st: ChampionshipState) {
  return Object.entries(st.table).sort(([, a], [, b]) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf).map(([id, r]) => ({ id, ...r }));
}

/** Difficoltà corrente (impostata dalla schermata di gioco) */
let currentLevel: Difficulty = 'facile';
export function setDifficultyLevel(l: Difficulty) { currentLevel = l; }
const OPP_BOOST: Record<Difficulty, number> = { facile: 0.08, medio: 0.18, difficile: 0.3 };

/**
 * Difficoltà scelta da Andrea: modifica portiere e difensori (difficulty), aiuto ai tiri (assist)
 * e, a Medio e Difficile, aggiunge il portiere e un difensore in più.
 */
export function applyDifficulty(cfg: MatchConfig, level: Difficulty): MatchConfig {
  const d = cfg.difficulty;
  const sc = { ...cfg.scenario, attackers: cfg.scenario.attackers.slice(), defenders: cfg.scenario.defenders.slice() };
  const normal = cfg.mode === 'normal';
  if (level === 'facile') {
    return { ...cfg, difficulty: Math.min(1, d * 0.9 + 0.25), assist: Math.max(0.7, Math.min(cfg.assist, 0.85)) };
  }
  if (normal) sc.keeper = true;
  if (level === 'medio') {
    return { ...cfg, scenario: sc, difficulty: Math.min(1, d + 0.4), assist: Math.min(cfg.assist, 0.5) };
  }
  // difficile: un difensore in più tra il portatore e la porta
  if (normal && !sc.looseBall) {
    const [ax, az] = sc.attackers[0];
    sc.defenders.push([Math.min(46, (ax + 52.5) / 2 + 2), az * 0.5]);
  }
  return { ...cfg, scenario: sc, difficulty: Math.min(1, d * 0.5 + 0.75), assist: 0.1, hint: false };
}
