import { Group, Mesh, MeshBasicMaterial, RingGeometry, Vector3, AdditiveBlending } from 'three';
import { Animator, type AnimName } from '../animation/Animator';
import { buildPlayer, type Joints } from '../animation/PlayerModel';
import type { Kit } from '../teams/teams';

export type Side = 'att' | 'def';
export type Role = 'player' | 'keeper';

const ringGeo = new RingGeometry(0.55, 0.75, 32);

/** Un calciatore in campo: modello 3D + animazioni + stato di movimento */
export class Player {
  joints: Joints;
  anim: Animator;
  pos = new Vector3();
  vel = new Vector3();
  facing = 0; // angolo (rad), 0 = verso +X
  target: Vector3 | null = null;
  maxSpeed = 6.5;
  ring: Mesh;
  private ringMat: MeshBasicMaterial;
  /** posizione dei piedi davanti al corpo dove si tiene il pallone */
  locked = false; // durante animazioni di calcio/tuffo non si muove da solo
  name = '';

  constructor(public id: number, public side: Side, public role: Role, kit: Kit, number: number, seed: number) {
    this.joints = buildPlayer(kit, number, seed, role === 'keeper');
    this.anim = new Animator(this.joints);
    this.ringMat = new MeshBasicMaterial({ color: side === 'att' ? '#ffe14d' : '#ff4d4d', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false });
    this.ring = new Mesh(ringGeo, this.ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.03;
    this.joints.root.add(this.ring);
  }

  get object(): Group { return this.joints.root; }

  setPos(x: number, z: number) { this.pos.set(x, 0, z); this.vel.set(0, 0, 0); this.target = null; this.sync(); }

  faceTo(p: Vector3, instant = false) {
    const a = Math.atan2(-(p.z - this.pos.z), p.x - this.pos.x);
    if (instant) this.facing = a;
    else this.facingTarget = a;
  }
  facingTarget: number | null = null;

  /** Punto davanti ai piedi (per tenere il pallone) */
  footPoint(out = new Vector3()) {
    return out.set(this.pos.x + Math.cos(this.facing) * 0.45, 0.11, this.pos.z - Math.sin(this.facing) * 0.45);
  }

  headPoint(out = new Vector3()) {
    return out.set(this.pos.x + Math.cos(this.facing) * 0.12, 1.85, this.pos.z - Math.sin(this.facing) * 0.12);
  }

  play(a: AnimName, opts?: { onContact?: () => void; force?: boolean }) { this.anim.play(a, opts); }

  highlight(level: number, color?: string) {
    this.ringMat.opacity = level;
    if (color) this.ringMat.color.set(color);
  }

  update(dt: number, time: number) {
    if (this.target && !this.locked) {
      const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.15) {
        const sp = Math.min(this.maxSpeed, d * 3);
        this.vel.set((dx / d) * sp, 0, (dz / d) * sp);
        this.facingTarget = Math.atan2(-dz, dx);
      } else { this.vel.set(0, 0, 0); this.target = null; }
    } else if (!this.locked) this.vel.multiplyScalar(0.8);
    this.pos.addScaledVector(this.vel, dt);
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (this.facingTarget !== null) {
      let diff = this.facingTarget - this.facing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.facing += diff * Math.min(1, dt * 10);
      if (Math.abs(diff) < 0.01) this.facingTarget = null;
    }
    if (!this.anim.isBusy && !this.locked) {
      const cur = this.anim.name;
      const idleish = cur === 'idle' || cur === 'walk' || cur === 'run' || cur === 'ready' || this.anim.done;
      if (idleish) {
        if (sp > 3) this.anim.play('run');
        else if (sp > 0.4) this.anim.play('walk');
        else this.anim.play(this.role === 'keeper' ? 'ready' : 'idle');
      }
    }
    this.anim.speed = sp;
    this.anim.update(dt);
    this.ring.scale.setScalar(1 + Math.sin(time * 5) * 0.08);
    this.sync();
  }

  sync() {
    this.joints.root.position.copy(this.pos);
    this.joints.root.rotation.y = this.facing;
  }
}
