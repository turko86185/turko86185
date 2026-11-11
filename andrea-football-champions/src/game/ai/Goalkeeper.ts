import { Vector3 } from 'three';
import { BallPhysics, type FlightPlan } from '../physics/BallPhysics';
import { GOAL } from '../physics/constants';
import type { Player } from '../engine/Player';

/**
 * Portiere semplificato: si posiziona, segue il pallone, si tuffa e para.
 * Difficoltà 0..1: tempi di reazione, raggio d'azione e probabilità di parata.
 */
export class GoalkeeperAI {
  willSave = false;
  catches = false;
  diving = false;
  private diveFrom = new Vector3();
  private diveTo = new Vector3();
  private diveT = 0;
  private diveDur = 0.45;
  private reactAt = 0;
  private t = 0;
  crossing: Vector3 | null = null;
  /** forzatura (rigori dell'avversario: la direzione la sceglie Andrea) */
  forcedSide: -1 | 0 | 1 | null = null;

  constructor(public p: Player, public difficulty: number, public goalX = GOAL.x) {
    p.maxSpeed = 4;
    p.facing = Math.PI;
  }

  home(ball: Vector3) {
    const dist = Math.hypot(ball.x - this.goalX, ball.z);
    const out = Math.min(2.2, Math.max(0.6, (40 - dist) * 0.06 + 0.6));
    const z = Math.max(-2.2, Math.min(2.2, ball.z * 0.18));
    return new Vector3(this.goalX - out, 0, z);
  }

  idle(ball: Vector3, instant = false) {
    if (this.diving) return;
    const h = this.home(ball);
    if (instant) this.p.setPos(h.x, h.z);
    else this.p.target = h;
    this.p.faceTo(ball);
  }

  reset() { this.willSave = false; this.diving = false; this.crossing = null; this.p.locked = false; this.t = 0; }

  /** Decide all'istante del tiro se e come parare (quanto basta per divertire) */
  onShot(plan: FlightPlan, rnd = Math.random) {
    this.reset();
    const c = BallPhysics.crossingAt(plan, this.p.pos.x);
    if (!c) return;
    this.crossing = c.point;
    const k = this.p.pos;
    const dz = c.point.z - k.z;
    const y = c.point.y;
    const inFrame = Math.abs(c.point.z) < GOAL.halfWidth + 0.3 && y < GOAL.height + 0.3;
    const d = this.difficulty;
    const reaction = 0.28 - 0.14 * d;
    const time = Math.max(0.05, c.t - reaction);
    const diveReach = 1.0 + 1.6 * d; // metri coperti col tuffo
    const handReach = 0.9 + (y > 1.6 ? -0.2 : 0);
    const needed = Math.max(0, Math.abs(dz) - handReach);
    const canReach = needed <= diveReach * Math.min(1, time / 0.45) && y < 2.35;
    const central = Math.abs(dz) < 0.8 && y < 1.7;
    const chance = central ? 0.3 + 0.55 * d : 0.15 + 0.6 * d;
    if (this.forcedSide !== null) {
      const ballSide = Math.abs(c.point.z) < 1.0 ? 0 : Math.sign(c.point.z);
      this.willSave = inFrame && this.forcedSide === ballSide && rnd() < 0.85;
    } else this.willSave = inFrame && canReach && rnd() < chance;
    this.catches = this.willSave && (central || plan.v0.length() < 18) && rnd() < 0.6;
    this.reactAt = reaction;
    // tuffo (o presa centrale)
    const side = this.forcedSide !== null ? this.forcedSide : (Math.abs(dz) < 0.6 ? 0 : Math.sign(dz));
    this.diveFrom.copy(k);
    const reachMove = this.willSave ? needed + 0.1 : Math.min(needed * 0.6, diveReach * 0.7);
    let targetZ = side === 0 ? k.z + dz * 0.8 : k.z + side * Math.max(0.3, reachMove);
    if (this.forcedSide !== null) targetZ = k.z + this.forcedSide * 1.6;
    this.diveTo.set(k.x - 0.1, 0, targetZ);
    this.diveDur = Math.max(0.2, Math.min(0.5, time));
    this.p.anim.diveSide = -(side || 1); // il portiere guarda verso -X: lato locale invertito
    this.p.anim.diveHeight = Math.min(1, y / 2.2);
    this.diving = false;
    this.pendingSide = side;
  }
  private pendingSide = 0;

  update(dt: number) {
    this.t += dt;
    if (this.crossing && !this.diving && this.t >= this.reactAt) {
      this.diving = true;
      this.diveT = 0;
      this.p.locked = true;
      this.p.target = null;
      this.p.play(this.pendingSide === 0 ? (this.crossing.y > 1.5 ? 'jump' : 'catch') : 'dive', { force: true });
    }
    if (this.diving) {
      this.diveT += dt;
      const u = Math.min(1, this.diveT / this.diveDur);
      const e = 1 - (1 - u) * (1 - u);
      this.p.pos.lerpVectors(this.diveFrom, this.diveTo, e);
    }
  }

  /** Il pallone arriva alle mani? */
  checkSave(ball: Vector3): boolean {
    if (!this.willSave || !this.crossing) return false;
    return ball.x >= this.p.pos.x - 0.35 && ball.x <= this.p.pos.x + 0.8;
  }

  /** punto in cui tiene il pallone dopo la presa */
  handsPoint(out = new Vector3()) {
    return out.set(this.p.pos.x - 0.4, this.crossing ? Math.min(1.6, Math.max(0.5, this.crossing.y)) : 1, this.p.pos.z);
  }
}
