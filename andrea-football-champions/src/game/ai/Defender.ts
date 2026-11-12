import { Vector3 } from 'three';
import { BallPhysics, type FlightPlan } from '../physics/BallPhysics';
import type { Player } from '../engine/Player';

/**
 * Difensore semplificato: si muove verso il pallone, prova a intercettare i passaggi,
 * protegge la porta, ma lascia sempre opportunità al bambino.
 */
export class DefenderAI {
  willIntercept = false;
  private interceptPoint: Vector3 | null = null;
  private chaseTarget = new Vector3();
  home = new Vector3();
  reachH = 1.25;

  constructor(public p: Player, public difficulty: number) {
    p.maxSpeed = 3.2 + 4 * difficulty;
    p.facing = Math.PI;
  }

  setHome(x: number, z: number) { this.home.set(x, 0, z); }

  /** Durante la mira: marcatura leggera tra il pallone e la porta */
  idle(ball: Vector3, goal: Vector3) {
    const toBall = ball.clone().sub(this.home);
    const d = toBall.length();
    const pull = Math.min(2.5, d * 0.12) * (0.3 + this.difficulty);
    const t = this.home.clone().addScaledVector(toBall.normalize(), pull);
    // si sposta un pochino verso la linea pallone–porta
    void goal;
    this.p.target = t;
    this.p.faceTo(ball);
  }

  /** Decide all'istante del calcio se proverà davvero l'intercetto */
  onKick(plan: FlightPlan, rnd = Math.random) {
    this.willIntercept = false;
    this.interceptPoint = null;
    const n = 30;
    const reaction = 0.35 - 0.25 * this.difficulty;
    const reach = 0.7 + 0.8 * this.difficulty;
    let best: { t: number; p: Vector3; slack: number } | null = null;
    for (let i = 2; i <= n; i++) {
      const t = (plan.T * i) / n;
      const bp = BallPhysics.positionAt(plan, t);
      if (bp.y > this.reachH + 0.6) continue;
      const dist = Math.hypot(bp.x - this.p.pos.x, bp.z - this.p.pos.z);
      const can = this.p.maxSpeed * Math.max(0, t - reaction) + reach;
      const slack = can - dist;
      if (bp.y < this.reachH && slack > 0 && (!best || t < best.t)) best = { t, p: bp, slack };
    }
    const chance = 0.06 + 0.7 * this.difficulty;
    if (best && rnd() < chance) {
      this.willIntercept = true;
      this.interceptPoint = best.p.setY(0);
    }
    // in ogni caso corre verso il pallone (ma se non intercetta si ferma un po' prima)
    const mid = BallPhysics.positionAt(plan, plan.T * 0.6).setY(0);
    const target = this.interceptPoint ?? mid;
    const dir = target.clone().sub(this.p.pos);
    const len = dir.length();
    this.chaseTarget.copy(this.willIntercept ? target : this.p.pos.clone().addScaledVector(dir.normalize(), Math.max(0, len - 0.9)));
    this.p.target = this.chaseTarget.clone();
  }

  /** Inseguimento di un pallone libero */
  chase(ball: Vector3, factor = 1) {
    this.p.target = ball.clone().setY(0);
    this.p.maxSpeed = (3.2 + 4 * this.difficulty) * factor;
  }

  canTouch(ball: Vector3): boolean {
    const d = Math.hypot(ball.x - this.p.pos.x, ball.z - this.p.pos.z);
    return d < 0.95 + 0.5 * this.difficulty && ball.y < this.reachH;
  }
}
