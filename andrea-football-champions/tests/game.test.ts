import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { BallPhysics } from '../src/game/physics/BallPhysics';
import { BALL_R, GOAL } from '../src/game/physics/constants';
import { planKick, pathDeviation, solveV0 } from '../src/game/trajectory/TrajectoryPlanner';
import { LEVELS, starsFor } from '../src/game/levels/levels';
import { TEAMS } from '../src/game/teams/teams';
import { SaveManager } from '../src/game/save/SaveManager';
import { recordRound, newChampionship, standings, PenaltySession, LevelSession } from '../src/game/match/sessions';
import { DefenderAI } from '../src/game/ai/Defender';

const line = (a: Vector3, b: Vector3, n = 12, bend = 0) => Array.from({ length: n }, (_, i) => {
  const t = i / (n - 1);
  const p = a.clone().lerp(b, t);
  const dir = b.clone().sub(a).normalize();
  p.x += -dir.z * bend * Math.sin(Math.PI * t);
  p.z += dir.x * bend * Math.sin(Math.PI * t);
  p.y = 0;
  return p;
});

function simulate(ball: BallPhysics, secs = 4) {
  const ev: string[] = [];
  for (let i = 0; i < secs * 60; i++) ball.update(1 / 60).forEach((e) => ev.push(e.type));
  return ev;
}

const base = { teammates: [], opponents: [], keeperPos: null, assist: 0.8, gestureSpeed: 1200, canShoot: true };

describe('Fisica del pallone', () => {
  it('equazione del moto: v0 porta esattamente al bersaglio', () => {
    const p0 = new Vector3(0, BALL_R, 0), P = new Vector3(20, 1, 5), a = new Vector3(0.5, -9.81, -1);
    const v0 = solveV0(p0, P, a, 1.2);
    const pos = BallPhysics.positionAt({ p0, v0, a, T: 1.2 }, 1.2);
    expect(pos.distanceTo(P)).toBeLessThan(1e-6);
  });
  it('rimbalza e rotola fino a fermarsi', () => {
    const b = new BallPhysics();
    b.reset(new Vector3(0, 3, 0));
    b.release(new Vector3(6, 2, 0));
    const ev = simulate(b, 12);
    expect(ev).toContain('bounce');
    expect(ev).toContain('stopped');
    expect(b.pos.y).toBeCloseTo(BALL_R, 2);
  });
  it('gol: il pallone entra in porta e muove la rete', () => {
    const b = new BallPhysics();
    const plan = planKick({ ...base, ballPos: new Vector3(40, BALL_R, 0), path: line(new Vector3(40, 0, 0), new Vector3(52, 0, 1)), goalPoint: new Vector3(GOAL.x, 1, 1) })!;
    expect(plan.isShot).toBe(true);
    b.launch(plan);
    const ev = simulate(b, 3);
    expect(ev).toContain('goal');
    expect(ev).toContain('net');
    expect(b.pos.x).toBeLessThanOrEqual(GOAL.x + GOAL.depth);
  });
  it('palo: il pallone che colpisce il palo rimbalza', () => {
    const b = new BallPhysics();
    b.reset(new Vector3(42, 1, GOAL.halfWidth));
    b.release(new Vector3(25, 0, 0));
    b.curveAcc.set(0, 0, 0);
    const ev = simulate(b, 1);
    expect(ev).toContain('post');
    expect(b.vel.x).toBeLessThan(0);
  });
  it('tiro fuori: nessun gol', () => {
    const b = new BallPhysics();
    b.reset(new Vector3(40, BALL_R, 0));
    b.release(new Vector3(20, 2, 8));
    const ev = simulate(b, 3);
    expect(ev).not.toContain('goal');
  });
});

describe('Traiettorie disegnate', () => {
  it('passaggio rasoterra al compagno con aggancio assistito', () => {
    const tm = new Vector3(30, 0, -6);
    const plan = planKick({ ...base, ballPos: new Vector3(18, BALL_R, 0), path: line(new Vector3(18, 0, 0), new Vector3(28, 0, -4)), teammates: [{ id: 1, pos: tm }] })!;
    expect(plan.isShot).toBe(false);
    expect(plan.receiverId).toBe(1);
    expect(plan.type).toBe('ground_pass');
    expect(plan.v0.y).toBe(0);
    expect(Math.hypot(plan.target.x - tm.x, plan.target.z - tm.z)).toBeLessThan(1);
  });
  it('passaggio sopra il difensore diventa un pallonetto', () => {
    const plan = planKick({ ...base, ballPos: new Vector3(26, BALL_R, 0), path: line(new Vector3(26, 0, 0), new Vector3(38, 0, 2)), teammates: [{ id: 1, pos: new Vector3(38, 0, 2) }], opponents: [{ pos: new Vector3(32, 0, 1) }] })!;
    expect(plan.type).toBe('lob_pass');
    expect(plan.beatsDefender).toBe(true);
    // il pallone passa sopra la testa del difensore
    const t = plan.T * 0.5;
    expect(BallPhysics.positionAt(plan, t).y).toBeGreaterThan(2);
  });
  it('passaggio in profondità e cross', () => {
    const through = planKick({ ...base, ballPos: new Vector3(24, BALL_R, 0), path: line(new Vector3(24, 0, 0), new Vector3(38, 0, 12)), teammates: [{ id: 1, pos: new Vector3(32, 0, 12) }] })!;
    expect(through.type).toBe('through_pass');
    const cross = planKick({ ...base, ballPos: new Vector3(41, BALL_R, 22), path: line(new Vector3(41, 0, 22), new Vector3(45, 0, -1)), teammates: [{ id: 1, pos: new Vector3(45, 0, -1) }] })!;
    expect(cross.type).toBe('cross');
    expect(cross.target.y).toBeGreaterThan(1.5);
  });
  it('tiro a effetto: la palla curva come il disegno', () => {
    const start = new Vector3(34, 0, -6);
    const path = line(start, new Vector3(52.5, 0, 2), 16, 5);
    const dev = pathDeviation(path, start, new Vector3(52.5, 0, 2));
    expect(dev.length()).toBeGreaterThan(3);
    const plan = planKick({ ...base, ballPos: new Vector3(34, BALL_R, -6), path })!;
    expect(plan.type).toBe('curl_shot');
    const mid = BallPhysics.positionAt(plan, plan.T / 2);
    const chordMid = new Vector3((34 + plan.target.x) / 2, 0, (-6 + plan.target.z) / 2);
    // la palla a metà volo è spostata dalla stessa parte del disegno
    expect(Math.sign((mid.x - chordMid.x) * dev.x + (mid.z - chordMid.z) * dev.z)).toBe(1);
  });
  it('assistenza: un tiro di poco fuori viene riportato nello specchio', () => {
    const plan = planKick({ ...base, assist: 1, ballPos: new Vector3(38, BALL_R, 0), path: line(new Vector3(38, 0, 0), new Vector3(52.5, 0, 5.5)), goalPoint: new Vector3(GOAL.x, 1, 5.5) })!;
    expect(plan.corrected).toBe(true);
    expect(Math.abs(plan.target.z)).toBeLessThan(GOAL.halfWidth);
    const b = new BallPhysics(); b.launch(plan);
    expect(simulate(b, 3)).toContain('goal');
  });
  it('senza assistenza lo stesso tiro va fuori', () => {
    const plan = planKick({ ...base, assist: 0, ballPos: new Vector3(38, BALL_R, 0), path: line(new Vector3(38, 0, 0), new Vector3(52.5, 0, 5.5)), goalPoint: new Vector3(GOAL.x, 1, 5.5) })!;
    expect(plan.corrected).toBe(false);
  });
  it('un disegno troppo corto non fa nulla', () => {
    expect(planKick({ ...base, ballPos: new Vector3(20, BALL_R, 0), path: [new Vector3(20, 0, 0), new Vector3(20.3, 0, 0)] })).toBeNull();
  });
});

describe('Difensori', () => {
  it('un difensore sulla linea intercetta un passaggio rasoterra (con difficoltà alta)', () => {
    const plan = planKick({ ...base, ballPos: new Vector3(20, BALL_R, 0), path: line(new Vector3(20, 0, 0), new Vector3(34, 0, 0)), teammates: [{ id: 1, pos: new Vector3(34, 0, 0) }], opponents: [] })!;
    const fake: any = { pos: new Vector3(27, 0, 1.5), maxSpeed: 6, target: null, facing: 0 };
    const ai = new DefenderAI(fake, 1);
    ai.onKick(plan, () => 0);
    expect(ai.willIntercept).toBe(true);
    const easy = new DefenderAI({ ...fake, pos: new Vector3(27, 0, 1.5) }, 0);
    easy.onKick(plan, () => 0.5); // al livello facile quasi mai
    expect(easy.willIntercept).toBe(false);
  });
});

describe('Contenuti', () => {
  it('20 squadre di Serie A 2026/27 con divise e giocatori', () => {
    expect(TEAMS).toHaveLength(20);
    const ids = TEAMS.map((t) => t.id);
    for (const id of ['roma', 'lazio', 'juventus', 'inter', 'milan', 'napoli', 'fiorentina', 'atalanta', 'venezia', 'frosinone', 'monza']) expect(ids).toContain(id);
    for (const id of ['pisa', 'cremonese', 'verona']) expect(ids).not.toContain(id);
    for (const t of TEAMS) { expect(t.players.fw).toHaveLength(3); expect(t.players.df.length).toBeGreaterThan(2); expect(t.home.primary).toMatch(/^#/); }
  });
  it('100 livelli in 4 capitoli, con finale', () => {
    expect(LEVELS).toHaveLength(100);
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(100);
    expect(LEVELS[99].stage).toBe('finale');
    for (const l of LEVELS) { expect(l.scenarios.length).toBeGreaterThan(0); expect(l.text.length).toBeGreaterThan(5); expect(l.difficulty).toBeLessThanOrEqual(0.8); }
    expect(starsFor(LEVELS[0], 1)).toBe(3);
    expect(starsFor(LEVELS[0], 9)).toBe(1);
  });
});

describe('Salvataggi e modalità', () => {
  it('salva e ricarica i progressi', () => {
    const mem: Record<string, string> = {};
    const st = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; } };
    const s1 = new SaveManager(st);
    s1.completeLevel(1, 3);
    s1.award('primo-gol');
    const s2 = new SaveManager(st);
    expect(s2.data.levels[1].stars).toBe(3);
    expect(s2.isUnlocked(2)).toBe(true);
    expect(s2.isUnlocked(3)).toBe(false);
    expect(s2.data.trophies).toContain('primo-gol');
  });
  it('campionato: 19 giornate, classifica coerente', () => {
    const st = newChampionship('roma');
    for (let i = 0; i < 19; i++) recordRound(st, 2, 0);
    expect(st.finished).toBe(true);
    const tb = standings(st);
    expect(tb[0].id).toBe('roma');
    expect(tb.find((r) => r.id === 'roma')!.pts).toBe(57);
  });
  it('rigori: termina quando il risultato è deciso', () => {
    const p = new PenaltySession('roma', 'inter', 'casa');
    const goal: any = { kind: 'goal' }, miss: any = { kind: 'saved' };
    let r;
    for (let i = 0; i < 3; i++) { p.onOutcome(goal); r = p.onOutcome(miss); }
    expect(r!.done).toBe(true);
    expect(r!.success).toBe(true);
  });
  it('livello: obiettivo passaggio e gol', () => {
    const s = new LevelSession(LEVELS[0], 'roma', 'casa');
    expect(s.onPass(1, false)!.done).toBe(true);
    const s3 = new LevelSession(LEVELS[2], 'roma', 'casa');
    expect(s3.onOutcome({ kind: 'miss' } as any).done).toBe(false);
    expect(s3.onOutcome({ kind: 'goal', passes: 0 } as any).done).toBe(true);
  });
});
