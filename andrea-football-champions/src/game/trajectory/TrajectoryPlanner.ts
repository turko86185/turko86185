import { Vector3 } from 'three';
import { BALL_R, FIELD, GOAL, GRAVITY } from '../physics/constants';
import type { FlightPlan } from '../physics/BallPhysics';

export type KickType = 'ground_pass' | 'through_pass' | 'lob_pass' | 'cross' | 'shot' | 'curl_shot' | 'chip_shot' | 'header';

export interface PlanInput {
  ballPos: Vector3;
  /** punti del disegno proiettati sul terreno (y = 0) */
  path: Vector3[];
  /** se il dito è stato rilasciato sopra lo specchio della porta: punto sul piano della porta */
  goalPoint?: Vector3 | null;
  teammates: { id: number; pos: Vector3 }[];
  opponents: { pos: Vector3 }[];
  keeperPos?: Vector3 | null;
  /** 0 = nessun aiuto, 1 = aiuto massimo */
  assist: number;
  /** velocità del gesto (px/s) per regolare la potenza */
  gestureSpeed: number;
  canShoot: boolean;
  /** il pallone è a mezz'aria (colpo di testa / al volo) */
  airborne?: boolean;
}

export interface KickPlan extends FlightPlan {
  type: KickType;
  target: Vector3;
  receiverId: number | null;
  /** effetto applicato (m di deviazione a metà traiettoria) */
  curveAmount: number;
  power: number;
  elevation: number;
  isShot: boolean;
  /** il tiro era fuori dallo specchio ed è stato corretto dall'assistenza */
  corrected: boolean;
  /** passa sopra/attorno a un difensore */
  beatsDefender: boolean;
}

const tmp = new Vector3();

export function pathLength(path: Vector3[]): number {
  let L = 0;
  for (let i = 1; i < path.length; i++) L += path[i].distanceTo(path[i - 1]);
  return L;
}

/** distanza orizzontale punto–segmento */
export function distPointSegment2D(p: Vector3, a: Vector3, b: Vector3): { d: number; t: number } {
  const abx = b.x - a.x, abz = b.z - a.z;
  const L2 = abx * abx + abz * abz || 1e-9;
  let t = ((p.x - a.x) * abx + (p.z - a.z) * abz) / L2;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + abx * t, cz = a.z + abz * t;
  return { d: Math.hypot(p.x - cx, p.z - cz), t };
}

/**
 * Deviazione laterale (con segno) del disegno rispetto alla corda inizio→fine, nel piano orizzontale.
 * Restituisce il vettore dal punto medio della corda al punto di massima deviazione.
 */
export function pathDeviation(path: Vector3[], start: Vector3, end: Vector3): Vector3 {
  const dir = new Vector3(end.x - start.x, 0, end.z - start.z);
  const L = dir.length();
  if (L < 1e-3 || path.length < 3) return new Vector3();
  dir.divideScalar(L);
  const perp = new Vector3(-dir.z, 0, dir.x);
  let best = 0;
  for (const p of path) {
    const along = (p.x - start.x) * dir.x + (p.z - start.z) * dir.z;
    if (along < L * 0.15 || along > L * 0.9) continue;
    const side = (p.x - start.x) * perp.x + (p.z - start.z) * perp.z;
    if (Math.abs(side) > Math.abs(best)) best = side;
  }
  return perp.multiplyScalar(best);
}

/** Calcola v0 tale che p0 + v0·T + ½·a·T² = P (equazione del moto ad accelerazione costante) */
export function solveV0(p0: Vector3, P: Vector3, a: Vector3, T: number): Vector3 {
  return new Vector3(
    (P.x - p0.x - 0.5 * a.x * T * T) / T,
    (P.y - p0.y - 0.5 * a.y * T * T) / T,
    (P.z - p0.z - 0.5 * a.z * T * T) / T
  );
}

function lobTime(y0: number, y1: number, apex: number): number {
  const h = Math.max(apex, y0 + 0.2, y1 + 0.2);
  const v0y = Math.sqrt(2 * GRAVITY * (h - y0));
  const disc = v0y * v0y - 2 * GRAVITY * (y1 - y0);
  return (v0y + Math.sqrt(Math.max(0, disc))) / GRAVITY;
}

/**
 * Trasforma il disegno del dito in un calcio: direzione, potenza, elevazione, effetto.
 * Include l'assistenza intelligente per i più piccoli.
 */
export function planKick(inp: PlanInput): KickPlan | null {
  const { ballPos, path, assist } = inp;
  if (path.length < 2 && !inp.goalPoint) return null;
  const end = (inp.goalPoint ?? path[path.length - 1]).clone();
  const flatDist = Math.hypot(end.x - ballPos.x, end.z - ballPos.z);
  if (flatDist < 1.2 && pathLength(path) < 1.5) return null;

  const p0 = ballPos.clone();
  const power = Math.max(0, Math.min(1, (inp.gestureSpeed - 300) / 2200));

  // ---------- È un tiro? ----------
  const nearGoalArea = end.x > GOAL.x - 13 && Math.abs(end.z) < GOAL.halfWidth + 6;
  const beyondLine = end.x > GOAL.x - 1.5 && Math.abs(end.z) < GOAL.halfWidth + 8;
  const snapRadius = 3.5 + 6 * assist;
  let receiver = nearestTeammate(inp.teammates, end, snapRadius);
  // un compagno molto vicino al punto finale ha la precedenza, a meno che il dito sia sulla porta
  const isShot = inp.canShoot && (!!inp.goalPoint || beyondLine || (nearGoalArea && (!receiver || receiver.d > 2.5) && end.x > ballPos.x));

  if (isShot) {
    let tz = end.z;
    let ty = inp.goalPoint ? inp.goalPoint.y : 0.35 + 1.4 * power;
    if (!inp.goalPoint && !beyondLine) {
      // estende la linea fino alla porta
      const dx = end.x - ballPos.x;
      if (dx > 0.5) tz = ballPos.z + (end.z - ballPos.z) * ((GOAL.x - ballPos.x) / dx);
    }
    let corrected = false;
    const margin = 0.35;
    const maxZ = GOAL.halfWidth - margin;
    // assistenza: se il tiro è "quasi" nello specchio, lo riporta dentro
    const forgivZ = maxZ + 4 * assist;
    if (Math.abs(tz) > maxZ && Math.abs(tz) < forgivZ) { tz = Math.sign(tz) * maxZ; corrected = true; }
    const forgivY = GOAL.height - 0.25 + 2.5 * assist;
    if (ty > GOAL.height - 0.25 && ty < forgivY) { ty = GOAL.height - 0.3; corrected = true; }
    ty = Math.max(BALL_R + 0.05, ty);
    // assistenza leggera: allontana il tiro dalle mani del portiere
    if (inp.keeperPos && assist > 0 && Math.abs(tz) <= maxZ) {
      const dk = tz - inp.keeperPos.z;
      if (Math.abs(dk) < 1.2) {
        const push = (1.2 - Math.abs(dk)) * assist * 0.8;
        const nz = tz + (dk >= 0 ? push : -push);
        if (Math.abs(nz) <= maxZ) { tz = nz; corrected = true; }
      }
    }
    const target = new Vector3(GOAL.x, ty, tz);
    const d = Math.hypot(target.x - p0.x, target.z - p0.z);
    const dev = pathDeviation(path, p0, new Vector3(target.x, 0, target.z));
    const curveMag = Math.min(dev.length() * 0.85, d * 0.22);
    const hasCurve = dev.length() > 0.8 && path.length >= 3;
    const speed = Math.min(30, 17 + 11 * power + d * 0.15);
    let T = d / speed;
    // pallonetto: se il portiere è fuori dai pali e si disegna un tiro lento
    const chip = !!inp.keeperPos && inp.keeperPos.x < GOAL.x - 5 && power < 0.15 && d > 10;
    const curve = hasCurve ? dev.clone().setLength(curveMag).multiplyScalar(-8 / (T * T)) : new Vector3();
    let a = new Vector3(curve.x, -GRAVITY, curve.z);
    if (chip) {
      T = lobTime(p0.y, ty, 4.5);
      a = new Vector3(curve.x * 0.3, -GRAVITY, curve.z * 0.3);
    }
    const v0 = solveV0(p0, target, a, T);
    const type: KickType = inp.airborne ? 'header' : chip ? 'chip_shot' : hasCurve ? 'curl_shot' : 'shot';
    return {
      p0, v0, a, T, curve: new Vector3(a.x, 0, a.z), type, target, receiverId: null,
      curveAmount: hasCurve ? curveMag : 0, power, elevation: Math.atan2(v0.y, Math.hypot(v0.x, v0.z)),
      isShot: true, corrected, beatsDefender: crossesDefender(p0, target, inp.opponents)
    };
  }

  // ---------- Passaggio ----------
  let target: Vector3;
  let type: KickType = 'ground_pass';
  let receiverId: number | null = null;
  if (receiver) {
    receiverId = receiver.id;
    const tm = receiver.pos;
    // Se il dito va un po' oltre il compagno è comunque un passaggio AL compagno.
    // Diventa un lancio in profondità solo se la linea prosegue chiaramente verso la porta,
    // e in quel caso il pallone va al massimo 5 m davanti a lui.
    const lead = new Vector3(end.x - tm.x, 0, end.z - tm.z);
    if (lead.length() > 5.5 && end.x > tm.x + 2) {
      lead.setLength(Math.min(lead.length(), 5));
      target = new Vector3(tm.x + lead.x, BALL_R, tm.z + lead.z);
      type = 'through_pass';
    } else target = new Vector3(tm.x, BALL_R, tm.z);
  } else {
    // nessun compagno vicino: passaggio nello spazio verso il compagno più vicino al punto
    const any = nearestTeammate(inp.teammates, end, 18);
    receiverId = any ? any.id : null;
    target = new Vector3(end.x, BALL_R, end.z);
    type = 'through_pass';
  }
  target.x = Math.max(-FIELD.halfLength + 1, Math.min(FIELD.halfLength - 1, target.x));
  target.z = Math.max(-FIELD.halfWidth + 1, Math.min(FIELD.halfWidth - 1, target.z));

  const d = Math.hypot(target.x - p0.x, target.z - p0.z);
  const blocked = crossesDefender(p0, target, inp.opponents);
  const dev = pathDeviation(path, p0, target);
  let hasCurve = dev.length() > 1.0 && path.length >= 3;
  // se il disegno gira attorno al difensore è un passaggio a effetto, altrimenti si scavalca
  const curvedAround = hasCurve && blocked && !curvedPathBlocked(p0, target, dev, inp.opponents);
  const inBox = target.x > GOAL.x - FIELD.boxDepth && Math.abs(target.z) < FIELD.boxHalfWidth;
  const wide = Math.abs(p0.z) > 13;
  let apex = 0;
  if (inBox && wide && receiverId !== null && type !== 'through_pass') { type = 'cross'; apex = 4.2; }
  else if (blocked && !curvedAround) { type = 'lob_pass'; apex = 3.3; }
  else if (d > 30) { type = 'lob_pass'; apex = 5; }

  let a: Vector3;
  let T: number;
  const curveMag = Math.min(dev.length() * 0.85, d * 0.25);
  if (apex > 0) {
    const y1 = type === 'cross' ? 1.85 : BALL_R;
    target.y = y1;
    T = lobTime(p0.y, y1, apex);
    const curve = hasCurve ? dev.clone().setLength(curveMag).multiplyScalar(-8 / (T * T)) : new Vector3();
    a = new Vector3(curve.x, -GRAVITY, curve.z);
  } else {
    // Passaggio rasoterra dosato: parte deciso e arriva morbido ai piedi del compagno
    // (la velocità del gesto conta poco, così un dito veloce non "spara" il pallone).
    const vStart = Math.max(8, Math.min(16, 8.5 + d * 0.18 + 2.5 * power));
    const vArrive = Math.min(vStart * 0.8, type === 'through_pass' ? 6 : 4.5);
    const fr = Math.max(0.5, Math.min(8, (vStart * vStart - vArrive * vArrive) / (2 * Math.max(d, 1))));
    T = (2 * d) / (vStart + vArrive);
    const dir = new Vector3(target.x - p0.x, 0, target.z - p0.z).normalize();
    const curve = hasCurve ? dev.clone().setLength(curveMag).multiplyScalar(-8 / (T * T)) : new Vector3();
    a = new Vector3(curve.x - dir.x * fr, 0, curve.z - dir.z * fr);
    target.y = BALL_R;
    if (p0.y > BALL_R + 0.05) a.y = -GRAVITY; // da colpo di testa
  }
  const v0 = solveV0(p0, target, a, T);
  if (!hasCurve) hasCurve = false;
  return {
    p0, v0, a, T, curve: hasCurve ? new Vector3(a.x, 0, a.z).setLength(Math.min(2, Math.hypot(a.x, a.z))) : undefined,
    type, target, receiverId, curveAmount: hasCurve ? curveMag : 0, power,
    elevation: Math.atan2(v0.y, Math.hypot(v0.x, v0.z)), isShot: false, corrected: false, beatsDefender: blocked
  };
}

function nearestTeammate(tms: { id: number; pos: Vector3 }[], p: Vector3, radius: number) {
  let best: { id: number; pos: Vector3; d: number } | null = null;
  for (const t of tms) {
    const d = Math.hypot(t.pos.x - p.x, t.pos.z - p.z);
    if (d < radius && (!best || d < best.d)) best = { ...t, d };
  }
  return best;
}

/** Un difensore si trova sulla linea retta del passaggio? */
export function crossesDefender(a: Vector3, b: Vector3, opps: { pos: Vector3 }[]): boolean {
  for (const o of opps) {
    const { d, t } = distPointSegment2D(o.pos, a, b);
    if (d < 1.7 && t > 0.08 && t < 0.95) return true;
  }
  return false;
}

function curvedPathBlocked(a: Vector3, b: Vector3, dev: Vector3, opps: { pos: Vector3 }[]): boolean {
  const mid = tmp.set((a.x + b.x) / 2 + dev.x, 0, (a.z + b.z) / 2 + dev.z).clone();
  return crossesDefender(a, mid, opps) || crossesDefender(mid, b, opps);
}

/** Campiona la traiettoria per il disegno della scia luminosa */
export function sampleTrajectory(plan: FlightPlan, n = 40): Vector3[] {
  const pts: Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (plan.T * i) / n;
    pts.push(new Vector3(
      plan.p0.x + plan.v0.x * t + 0.5 * plan.a.x * t * t,
      Math.max(BALL_R, plan.p0.y + plan.v0.y * t + 0.5 * plan.a.y * t * t),
      plan.p0.z + plan.v0.z * t + 0.5 * plan.a.z * t * t
    ));
  }
  return pts;
}
