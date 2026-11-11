import type { Joints } from './PlayerModel';

export type AnimName =
  | 'idle' | 'walk' | 'run' | 'kick' | 'pass' | 'header' | 'tackle' | 'dive' | 'catch'
  | 'celebrate' | 'kneeSlide' | 'sad' | 'hug' | 'ready' | 'jump' | 'lookUp';

interface Pose {
  bodyY: number; bodyRotX: number; bodyRotZ: number; spineZ: number; headZ: number;
  shL: number; shR: number; shLx: number; shRx: number; elL: number; elR: number;
  hipL: number; hipR: number; knL: number; knR: number;
}

const ZERO: Pose = { bodyY: 0.95, bodyRotX: 0, bodyRotZ: 0, spineZ: 0, headZ: 0, shL: 0, shR: 0, shLx: -0.12, shRx: 0.12, elL: 0.15, elR: 0.15, hipL: 0, hipR: 0, knL: 0, knR: 0 };
const ONE_SHOT: Partial<Record<AnimName, number>> = { kick: 0.55, pass: 0.45, header: 0.8, tackle: 0.9, dive: 1.3, catch: 0.6, jump: 0.7 };
const KEYS = Object.keys(ZERO) as (keyof Pose)[];

/**
 * Animazioni procedurali sincronizzate: ogni animazione è una funzione del tempo che
 * produce una posa; le pose vengono fuse (blend) in modo morbido.
 */
export class Animator {
  name: AnimName = 'idle';
  t = 0;
  speed = 0; // velocità di corsa (m/s) per la cadenza
  diveSide = 1; // +1 = verso +Z
  diveHeight = 0.5; // 0 = rasoterra, 1 = alto
  private pose: Pose = { ...ZERO };
  private blend = 1;
  onContact: (() => void) | null = null;
  private contactFired = false;
  done = false;

  constructor(private j: Joints, private phase = Math.random() * 10) {}

  play(name: AnimName, opts?: { onContact?: () => void; force?: boolean }) {
    if (this.name === name && !opts?.force && !ONE_SHOT[name]) return;
    this.name = name;
    this.t = 0;
    this.blend = 0;
    this.done = false;
    this.contactFired = false;
    this.onContact = opts?.onContact ?? null;
  }

  get isBusy() { return !!ONE_SHOT[this.name] && !this.done; }

  update(dt: number) {
    this.t += dt;
    this.blend = Math.min(1, this.blend + dt * 8);
    const dur = ONE_SHOT[this.name];
    if (dur && this.t >= dur) this.done = true;
    const target = this.compute(this.name, this.t);
    const k = this.blend >= 1 ? 1 : this.blend;
    const p = this.pose;
    for (const key of KEYS) p[key] = p[key] + (target[key] - p[key]) * Math.min(1, k * 0.5 + dt * 14);
    this.apply();
  }

  private compute(name: AnimName, t: number): Pose {
    const p: Pose = { ...ZERO };
    const tt = t + this.phase;
    switch (name) {
      case 'idle': {
        const b = Math.sin(tt * 2) * 0.015;
        p.bodyY = 0.95 + b; p.shL = 0.05; p.shR = -0.05; p.headZ = Math.sin(tt * 0.7) * 0.05;
        break;
      }
      case 'ready': { // portiere pronto
        p.bodyY = 0.82; p.knL = -0.6; p.knR = -0.6; p.hipL = 0.35; p.hipR = 0.35; p.spineZ = -0.25;
        p.shL = 0.6; p.shR = 0.6; p.shLx = -0.5; p.shRx = 0.5; p.elL = 0.6; p.elR = 0.6;
        p.bodyY += Math.sin(tt * 6) * 0.015;
        break;
      }
      case 'walk':
      case 'run': {
        const run = name === 'run';
        const cad = run ? 2.2 + Math.min(this.speed, 8) * 0.35 : 1.6;
        const s = Math.sin(tt * cad * Math.PI);
        const c = Math.cos(tt * cad * Math.PI);
        const amp = run ? 0.75 : 0.35;
        p.hipL = s * amp; p.hipR = -s * amp;
        p.knL = -Math.max(0, -c) * (run ? 1.3 : 0.5) - 0.1;
        p.knR = -Math.max(0, c) * (run ? 1.3 : 0.5) - 0.1;
        p.shL = -s * amp * 0.9; p.shR = s * amp * 0.9;
        p.elL = run ? 1.3 : 0.3; p.elR = run ? 1.3 : 0.3;
        p.spineZ = run ? -0.15 : 0;
        p.bodyY = 0.95 + Math.abs(c) * (run ? 0.06 : 0.02) - (run ? 0.03 : 0);
        break;
      }
      case 'kick':
      case 'pass': {
        const d = ONE_SHOT[name]!;
        const u = Math.min(1, t / d);
        const contact = 0.42;
        // caricamento all'indietro, poi slancio in avanti della gamba destra
        const swing = u < contact ? -1.0 * Math.sin((u / contact) * Math.PI * 0.5) : -1.0 + 2.6 * Math.sin(((u - contact) / (1 - contact)) * Math.PI * 0.5);
        const power = name === 'kick' ? 1 : 0.6;
        p.hipR = swing * power;
        p.knR = u < contact ? -1.4 * (u / contact) : -1.4 * (1 - (u - contact) / (1 - contact)) * 0.6;
        p.hipL = 0.15; p.knL = -0.25;
        p.shL = 0.9 * power; p.shLx = -0.8; p.shR = -0.5; p.shRx = 0.6;
        p.spineZ = u > contact ? -0.2 : 0.1;
        p.bodyRotX = -0.1;
        p.bodyY = 0.92;
        if (!this.contactFired && u >= contact) { this.contactFired = true; this.onContact?.(); }
        break;
      }
      case 'header': {
        const u = Math.min(1, t / ONE_SHOT.header!);
        const jump = Math.sin(Math.min(1, u * 1.3) * Math.PI);
        p.bodyY = 0.95 + jump * 0.55;
        p.knL = -0.9 * jump; p.knR = -0.9 * jump; p.hipL = 0.4 * jump; p.hipR = 0.4 * jump;
        p.shL = 0.6; p.shR = 0.6; p.shLx = -0.9; p.shRx = 0.9; p.elL = 0.8; p.elR = 0.8;
        const nod = u < 0.45 ? 0.5 * (u / 0.45) : 0.5 - 1.4 * Math.min(1, (u - 0.45) / 0.2);
        p.spineZ = nod * 0.6; p.headZ = nod * 0.6;
        if (!this.contactFired && u >= 0.5) { this.contactFired = true; this.onContact?.(); }
        break;
      }
      case 'jump': {
        const u = Math.min(1, t / ONE_SHOT.jump!);
        const jump = Math.sin(u * Math.PI);
        p.bodyY = 0.95 + jump * 0.45; p.knL = -0.7 * jump; p.knR = -0.7 * jump;
        p.shL = 2.6 * jump; p.shR = 2.6 * jump;
        break;
      }
      case 'tackle': { // scivolata
        const u = Math.min(1, t / ONE_SHOT.tackle!);
        const s = Math.sin(Math.min(1, u * 1.5) * Math.PI * 0.5);
        p.bodyY = 0.95 - 0.6 * s; p.spineZ = -0.9 * s * 0 + 0.6 * s; p.bodyRotX = 0;
        p.hipR = 1.4 * s; p.knR = -0.1; p.hipL = 0.5 * s; p.knL = -1.4 * s;
        p.shL = -0.5 * s; p.shR = -0.8 * s; p.shLx = -1.0 * s; p.shRx = 0.4;
        if (!this.contactFired && u >= 0.35) { this.contactFired = true; this.onContact?.(); }
        break;
      }
      case 'dive': {
        const u = Math.min(1, t / ONE_SHOT.dive!);
        const s = Math.sin(Math.min(1, u * 2.2) * Math.PI * 0.5);
        const land = u > 0.55 ? Math.min(1, (u - 0.55) / 0.3) : 0;
        const h = this.diveHeight;
        p.bodyRotX = this.diveSide * 1.35 * s; // rotolamento laterale
        p.bodyY = 0.95 + (0.35 + h * 0.6) * Math.sin(Math.min(1, u * 1.8) * Math.PI) * (1 - land) - land * 0.68;
        p.shL = 0.2; p.shR = 0.2;
        const up = 2.9;
        p.shLx = this.diveSide > 0 ? -0.2 : -up * s; p.shRx = this.diveSide > 0 ? up * s : 0.2;
        p.shL = this.diveSide > 0 ? 0.6 : 0.2; p.shR = this.diveSide > 0 ? 0.2 : 0.6;
        p.elL = 0.1; p.elR = 0.1;
        p.hipL = 0.2; p.hipR = 0.2; p.knL = -0.3; p.knR = -0.5;
        if (!this.contactFired && u >= 0.25) { this.contactFired = true; this.onContact?.(); }
        break;
      }
      case 'catch': {
        p.bodyY = 0.85; p.spineZ = -0.35; p.knL = -0.5; p.knR = -0.5; p.hipL = 0.3; p.hipR = 0.3;
        p.shL = 1.0; p.shR = 1.0; p.shLx = -0.2; p.shRx = 0.2; p.elL = 1.6; p.elR = 1.6;
        break;
      }
      case 'celebrate': {
        const j = Math.abs(Math.sin(tt * 5));
        p.bodyY = 0.95 + j * 0.35; p.knL = -j * 0.8; p.knR = -j * 0.8; p.hipL = j * 0.3; p.hipR = j * 0.3;
        p.shL = 0.1; p.shR = 0.1; p.shLx = -2.7 + Math.sin(tt * 10) * 0.2; p.shRx = 2.7 - Math.sin(tt * 10) * 0.2;
        p.elL = 0.2; p.elR = 0.2; p.headZ = 0.3;
        break;
      }
      case 'kneeSlide': {
        p.bodyY = 0.52; p.hipL = 0.1; p.hipR = 0.1; p.knL = -1.55; p.knR = -1.55; p.spineZ = 0.35; p.headZ = 0.4;
        p.shLx = -1.3; p.shRx = 1.3; p.shL = 0.3; p.shR = 0.3; p.elL = 0.2; p.elR = 0.2;
        break;
      }
      case 'hug': {
        const j = Math.abs(Math.sin(tt * 4)) * 0.15;
        p.bodyY = 0.95 + j; p.shL = 1.3; p.shR = 1.3; p.shLx = 0.3; p.shRx = -0.3; p.elL = 1.0; p.elR = 1.0;
        break;
      }
      case 'lookUp': { // attende il cross per il colpo di testa
        p.headZ = 0.5; p.spineZ = 0.15; p.bodyY = 0.9 + Math.sin(tt * 8) * 0.02; p.knL = -0.4; p.knR = -0.4; p.hipL = 0.2; p.hipR = 0.2;
        p.shLx = -0.7; p.shRx = 0.7; p.shL = 0.4; p.shR = 0.4;
        break;
      }
      case 'sad': { // delusione leggera: mani sulla testa
        p.headZ = -0.45; p.spineZ = -0.2; p.shL = 0.4; p.shR = 0.4; p.shLx = -2.2; p.shRx = 2.2; p.elL = 2.3; p.elR = 2.3;
        p.bodyY = 0.94 + Math.sin(tt * 1.5) * 0.01;
        break;
      }
    }
    return p;
  }

  private apply() {
    const j = this.j, p = this.pose;
    j.body.position.y = p.bodyY;
    j.body.rotation.x = p.bodyRotX;
    j.body.rotation.z = p.bodyRotZ;
    j.spine.rotation.z = p.spineZ;
    j.head.rotation.z = p.headZ;
    j.shoulderL.rotation.set(-p.shLx, 0, p.shL);
    j.shoulderR.rotation.set(-p.shRx, 0, p.shR);
    j.elbowL.rotation.z = p.elL;
    j.elbowR.rotation.z = p.elR;
    j.hipL.rotation.z = p.hipL;
    j.hipR.rotation.z = p.hipR;
    j.kneeL.rotation.z = p.knL;
    j.kneeR.rotation.z = p.knR;
  }
}
