import { PerspectiveCamera, Vector3 } from 'three';
import { GOAL } from '../physics/constants';

export type CamMode = 'aim' | 'follow' | 'celebrate' | 'intro' | 'penalty' | 'menu' | 'keeper';

/** Telecamera dinamica: mantiene visibili pallone, giocatori e porta */
export class CameraDirector {
  mode: CamMode = 'menu';
  private desiredPos = new Vector3(0, 30, 40);
  private desiredLook = new Vector3();
  private look = new Vector3();
  private t = 0;
  focus = new Vector3();
  interest: Vector3[] = [];
  private shake = 0;

  constructor(public cam: PerspectiveCamera) {}

  set(mode: CamMode, focus?: Vector3, interest: Vector3[] = []) {
    this.mode = mode;
    if (focus) this.focus.copy(focus);
    this.interest = interest;
    this.t = 0;
  }

  addShake(v: number) { this.shake = Math.max(this.shake, v); }

  snap() {
    this.compute();
    this.cam.position.copy(this.desiredPos);
    this.look.copy(this.desiredLook);
    this.cam.lookAt(this.look);
  }

  private fits(pos: Vector3, look: Vector3, pts: Vector3[]): boolean {
    const c = this.cam;
    const saveP = c.position.clone();
    const saveQ = c.quaternion.clone();
    c.position.copy(pos); c.lookAt(look); c.updateMatrixWorld();
    let ok = true;
    for (const p of pts) {
      const v = p.clone().project(c);
      if (v.z > 1 || Math.abs(v.x) > 0.85 || v.y > 0.72 || v.y < -0.62) { ok = false; break; }
    }
    c.position.copy(saveP); c.quaternion.copy(saveQ); c.updateMatrixWorld();
    return ok;
  }

  private compute() {
    const f = this.focus;
    const goal = new Vector3(GOAL.x, 1, 0);
    switch (this.mode) {
      case 'aim':
      case 'intro': {
        const dir = new Vector3(goal.x - f.x, 0, goal.z - f.z);
        const dist = dir.length();
        dir.normalize();
        // look: tra il giocatore e la porta
        const look = f.clone().lerp(goal, dist > 28 ? 0.32 : Math.min(0.55, 10 / Math.max(10, dist) + 0.2));
        look.y = 0.5;
        const pts = [f.clone().setY(0), f.clone().setY(1.9), ...this.interest];
        if (dist < 28) pts.push(goal.clone().setY(2.4), goal.clone().setY(0).setZ(-GOAL.halfWidth), goal.clone().setY(0).setZ(GOAL.halfWidth));
        let chosen = new Vector3();
        for (let back = 5; back <= 40; back += 1) {
          const pos = f.clone().addScaledVector(dir, -back);
          pos.y = 2.4 + back * 0.36;
          chosen = pos;
          if (this.fits(pos, look, pts)) break;
        }
        this.desiredPos.copy(chosen);
        this.desiredLook.copy(look);
        break;
      }
      case 'penalty': {
        this.desiredPos.set(f.x - 5.5, 2.3, f.z * 0.5);
        this.desiredLook.set(GOAL.x, 0.2, 0);
        break;
      }
      case 'keeper': { // rigore avversario: vista da dietro la porta
        this.desiredPos.set(GOAL.x + 6, 2.6, 0);
        this.desiredLook.set(GOAL.x - 11, 0.8, 0);
        break;
      }
      case 'follow': {
        const dirX = Math.max(f.x - 14, Math.min(f.x - 8, GOAL.x - 20));
        this.desiredPos.set(dirX, 7 + f.y * 0.4, f.z * 0.7);
        this.desiredLook.set(f.x + 4, Math.max(0.5, f.y * 0.7), f.z * 0.9);
        break;
      }
      case 'celebrate': {
        const a = this.t * 0.35;
        this.desiredPos.set(f.x + Math.cos(a) * 7, 2.4, f.z + Math.sin(a) * 7);
        this.desiredLook.set(f.x, 1.2, f.z);
        break;
      }
      case 'menu': {
        const a = this.t * 0.05;
        this.desiredPos.set(Math.cos(a) * 70, 28, Math.sin(a) * 55);
        this.desiredLook.set(0, 0, 0);
        break;
      }
    }
  }

  update(dt: number) {
    this.t += dt;
    if (this.mode === 'aim' && this.t > 0.05 && this.t < 0.1) { /* calcolo all'inizio */ }
    if (this.mode !== 'aim' || this.t < 0.2) this.compute();
    const k = this.mode === 'follow' ? 4 : this.mode === 'celebrate' ? 1.5 : 2.5;
    const a = 1 - Math.exp(-k * dt);
    this.cam.position.lerp(this.desiredPos, a);
    this.look.lerp(this.desiredLook, a);
    this.cam.lookAt(this.look);
    if (this.shake > 0) {
      this.cam.position.x += (Math.random() - 0.5) * this.shake;
      this.cam.position.y += (Math.random() - 0.5) * this.shake;
      this.shake *= Math.exp(-6 * dt);
      if (this.shake < 0.01) this.shake = 0;
    }
  }
}
