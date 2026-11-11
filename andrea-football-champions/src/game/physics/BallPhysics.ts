import { Vector3 } from 'three';
import { BALL_R, FIELD, GOAL, GRAVITY } from './constants';

export type BallEvent =
  | { type: 'bounce'; speed: number }
  | { type: 'post'; point: Vector3; speed: number }
  | { type: 'goal'; point: Vector3 }
  | { type: 'net'; point: Vector3; speed: number }
  | { type: 'out' }
  | { type: 'arrived' }
  | { type: 'stopped' };

export interface FlightPlan {
  p0: Vector3;
  v0: Vector3;
  /** accelerazione costante durante il volo pianificato (gravità + effetto + attrito) */
  a: Vector3;
  T: number;
  /** componente di effetto (Magnus) inclusa in a, che prosegue dopo l'arrivo */
  curve?: Vector3;
}

const ROLL_FRICTION = 1.6; // m/s² decelerazione a terra
const AIR_DRAG = 0.012; // coeff. resistenza aria (proporzionale a v²)
const RESTITUTION_GROUND = 0.55;
const RESTITUTION_POST = 0.7;

/**
 * Fisica del pallone. Due modalità:
 *  - "planned": il pallone segue esattamente l'equazione del moto p0 + v0·t + ½·a·t²
 *    (calcolata dal TrajectoryPlanner a partire dal disegno del dito), con controlli di collisione.
 *  - "free": integrazione numerica con gravità, attrito, rimbalzi, pali, rete.
 */
export class BallPhysics {
  pos = new Vector3(0, BALL_R, 0);
  vel = new Vector3();
  /** asse e velocità angolare per la rotazione visiva */
  spinAxis = new Vector3(1, 0, 0);
  spinRate = 0;
  /** spin laterale residuo (effetto) applicato in modalità libera */
  curveAcc = new Vector3();
  mode: 'held' | 'planned' | 'free' = 'held';
  plan: FlightPlan | null = null;
  t = 0;
  inGoal = false;
  goalScored = false;
  outOfPlay = false;
  stopped = false;
  private tmp = new Vector3();

  hold(p: Vector3) {
    this.mode = 'held';
    this.pos.copy(p);
    this.vel.set(0, 0, 0);
    this.plan = null;
    this.stopped = false;
  }

  reset(p: Vector3) {
    this.hold(p);
    this.inGoal = false;
    this.goalScored = false;
    this.outOfPlay = false;
    this.curveAcc.set(0, 0, 0);
  }

  launch(plan: FlightPlan) {
    this.mode = 'planned';
    this.plan = plan;
    this.t = 0;
    this.pos.copy(plan.p0);
    this.vel.copy(plan.v0);
    this.stopped = false;
    // effetto residuo = componente orizzontale non-attrito dell'accelerazione
    if (plan.curve) this.curveAcc.copy(plan.curve); else this.curveAcc.set(0, 0, 0);
  }

  /** Passa alla fisica libera (es. dopo un impatto o una deviazione) */
  release(vel?: Vector3) {
    if (vel) this.vel.copy(vel);
    this.mode = 'free';
    this.plan = null;
    this.curveAcc.multiplyScalar(0.3);
  }

  update(dt: number): BallEvent[] {
    const events: BallEvent[] = [];
    if (this.mode === 'held') return events;
    const prev = this.tmp.copy(this.pos);

    if (this.mode === 'planned' && this.plan) {
      const p = this.plan;
      this.t = Math.min(this.t + dt, p.T);
      const t = this.t;
      this.pos.set(
        p.p0.x + p.v0.x * t + 0.5 * p.a.x * t * t,
        p.p0.y + p.v0.y * t + 0.5 * p.a.y * t * t,
        p.p0.z + p.v0.z * t + 0.5 * p.a.z * t * t
      );
      this.vel.set(p.v0.x + p.a.x * t, p.v0.y + p.a.y * t, p.v0.z + p.a.z * t);
      if (this.pos.y < BALL_R) this.pos.y = BALL_R;
      if (t >= p.T) {
        events.push({ type: 'arrived' });
        this.release();
      }
    } else {
      this.integrateFree(dt, events);
    }

    this.collidePosts(events);
    this.handleGoalAndNet(prev, events);

    // rotazione visiva
    const hv = Math.hypot(this.vel.x, this.vel.z);
    if (hv > 0.01) {
      this.spinAxis.set(this.vel.z, 0, -this.vel.x).normalize();
      this.spinRate = hv / BALL_R;
    } else this.spinRate *= 0.9;

    if (!this.outOfPlay && !this.inGoal && (Math.abs(this.pos.x) > FIELD.halfLength + 0.5 || Math.abs(this.pos.z) > FIELD.halfWidth + 0.5)) {
      this.outOfPlay = true;
      events.push({ type: 'out' });
    }
    return events;
  }

  private integrateFree(dt: number, events: BallEvent[]) {
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const onGround = this.pos.y <= BALL_R + 0.001 && Math.abs(this.vel.y) < 0.5;
      const speed = this.vel.length();
      // resistenza dell'aria
      if (speed > 0) this.vel.addScaledVector(this.vel, -AIR_DRAG * speed * h * 0.1);
      // effetto (Magnus semplificato) che si esaurisce
      this.vel.addScaledVector(this.curveAcc, h);
      this.curveAcc.multiplyScalar(Math.exp(-1.5 * h));
      if (onGround) {
        this.pos.y = BALL_R;
        this.vel.y = 0;
        const hv = Math.hypot(this.vel.x, this.vel.z);
        if (hv > 0) {
          const nv = Math.max(0, hv - ROLL_FRICTION * h);
          this.vel.x *= nv / hv;
          this.vel.z *= nv / hv;
        }
        this.curveAcc.multiplyScalar(0.9);
      } else {
        this.vel.y -= GRAVITY * h;
      }
      this.pos.addScaledVector(this.vel, h);
      if (this.pos.y < BALL_R) {
        this.pos.y = BALL_R;
        if (this.vel.y < -1.0) {
          events.push({ type: 'bounce', speed: -this.vel.y });
          this.vel.y = -this.vel.y * RESTITUTION_GROUND;
          this.vel.x *= 0.88;
          this.vel.z *= 0.88;
        } else this.vel.y = 0;
      }
    }
    if (!this.stopped && this.vel.length() < 0.15 && this.pos.y <= BALL_R + 0.01) {
      this.vel.set(0, 0, 0);
      this.stopped = true;
      events.push({ type: 'stopped' });
    }
  }

  /** Collisione sfera–segmento con pali e traversa della porta d'attacco */
  private collidePosts(events: BallEvent[]) {
    const segs: [Vector3, Vector3][] = [
      [new Vector3(GOAL.x, 0, -GOAL.halfWidth), new Vector3(GOAL.x, GOAL.height, -GOAL.halfWidth)],
      [new Vector3(GOAL.x, 0, GOAL.halfWidth), new Vector3(GOAL.x, GOAL.height, GOAL.halfWidth)],
      [new Vector3(GOAL.x, GOAL.height, -GOAL.halfWidth), new Vector3(GOAL.x, GOAL.height, GOAL.halfWidth)]
    ];
    if (Math.abs(this.pos.x - GOAL.x) > 1) return;
    for (const [a, b] of segs) {
      const ab = b.clone().sub(a);
      const t = Math.max(0, Math.min(1, this.pos.clone().sub(a).dot(ab) / ab.lengthSq()));
      const closest = a.clone().addScaledVector(ab, t);
      const n = this.pos.clone().sub(closest);
      const d = n.length();
      const minD = BALL_R + GOAL.postRadius;
      if (d < minD && d > 1e-6) {
        n.divideScalar(d);
        const vn = this.vel.dot(n);
        if (vn < 0) {
          const speed = this.vel.length();
          if (this.mode === 'planned') this.release();
          this.vel.addScaledVector(n, -(1 + RESTITUTION_POST) * vn);
          this.pos.copy(closest).addScaledVector(n, minD + 0.001);
          events.push({ type: 'post', point: closest.clone(), speed });
        }
      }
    }
  }

  private handleGoalAndNet(prev: Vector3, events: BallEvent[]) {
    const p = this.pos;
    const insideMouth = (q: Vector3) => Math.abs(q.z) < GOAL.halfWidth - BALL_R * 0.5 && q.y < GOAL.height;
    // Gol: il pallone supera completamente la linea di porta tra i pali e sotto la traversa
    if (!this.goalScored && !this.outOfPlay && p.x > GOAL.x + BALL_R && prev.x <= GOAL.x + BALL_R + 0.5 && insideMouth(p)) {
      this.goalScored = true;
      this.inGoal = true;
      events.push({ type: 'goal', point: p.clone() });
    }
    if (this.inGoal) {
      const backX = GOAL.x + GOAL.depth - BALL_R;
      if (p.x > backX) {
        p.x = backX;
        const sp = this.vel.length();
        if (this.mode === 'planned') this.release();
        this.vel.x *= -0.12;
        this.vel.y *= 0.4;
        this.vel.z *= 0.4;
        this.curveAcc.set(0, 0, 0);
        events.push({ type: 'net', point: p.clone(), speed: sp });
      }
      const sideZ = GOAL.halfWidth - BALL_R;
      if (Math.abs(p.z) > sideZ) {
        p.z = Math.sign(p.z) * sideZ;
        this.vel.z *= -0.15;
        this.vel.x *= 0.6;
      }
      if (p.y > GOAL.height - BALL_R) {
        p.y = GOAL.height - BALL_R;
        this.vel.y = Math.min(0, this.vel.y) * 0.2;
      }
    } else if (!this.outOfPlay && p.x > GOAL.x && prev.x <= GOAL.x && !insideMouth(p)) {
      // fuori: a lato o sopra la porta
      if (Math.abs(p.z) < GOAL.halfWidth + 0.4 && p.y < GOAL.height + 0.3 && Math.abs(p.z) >= GOAL.halfWidth) {
        // rete esterna
        events.push({ type: 'net', point: p.clone(), speed: this.vel.length() });
      }
    }
  }

  /** Previsione: punto in cui il volo pianificato attraversa il piano x = X (null se non lo raggiunge) */
  static crossingAt(plan: FlightPlan, X: number): { t: number; point: Vector3 } | null {
    const { p0, v0, a, T } = plan;
    // risolve p0.x + v0.x t + ½ a.x t² = X
    const A = 0.5 * a.x, B = v0.x, C = p0.x - X;
    let t: number | null = null;
    if (Math.abs(A) < 1e-6) t = B !== 0 ? -C / B : null;
    else {
      const disc = B * B - 4 * A * C;
      if (disc >= 0) {
        const s = Math.sqrt(disc);
        const cands = [(-B - s) / (2 * A), (-B + s) / (2 * A)].filter((x) => x >= 0).sort((x, y) => x - y);
        t = cands.length ? cands[0] : null;
      }
    }
    if (t === null || t < 0) return null;
    if (t > T * 1.5) return null;
    const tt = Math.min(t, T * 1.5);
    return {
      t: tt,
      point: new Vector3(p0.x + v0.x * tt + 0.5 * a.x * tt * tt, Math.max(BALL_R, p0.y + v0.y * tt + 0.5 * a.y * tt * tt), p0.z + v0.z * tt + 0.5 * a.z * tt * tt)
    };
  }

  static positionAt(plan: FlightPlan, t: number, out = new Vector3()) {
    const { p0, v0, a } = plan;
    return out.set(p0.x + v0.x * t + 0.5 * a.x * t * t, Math.max(BALL_R, p0.y + v0.y * t + 0.5 * a.y * t * t), p0.z + v0.z * t + 0.5 * a.z * t * t);
  }
}
