// Calciatori 3D articolati (animazioni procedurali di corsa, tiro, parata, esultanza) e pallone con fisica.
import * as THREE from '../vendor/three.module.min.js';
import { shirtCanvas } from '../teams.js';
import { FIELD } from './world.js';

const geoCache = {};
function G(key, make) { return geoCache[key] || (geoCache[key] = make()); }

let shadowTex = null;
function blobShadowTex() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}
export function makeShadow(size) {
  const m = new THREE.Mesh(G('shadowPlane', () => new THREE.PlaneGeometry(1, 1)),
    new THREE.MeshBasicMaterial({ map: blobShadowTex(), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.scale.set(size, size, 1); m.position.y = 0.02;
  m.renderOrder = 1;
  return m;
}

export class Player {
  constructor(info, kit, team, isKeeper) {
    this.info = info; this.team = team; this.isKeeper = isKeeper;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.facing = 0;            // angolo (rad) su Y; 0 = +z
    this.target = new THREE.Vector3(); this.speedMul = 1;
    this.runPhase = Math.random() * 6;
    this.kickT = 0; this.diveT = 0; this.diveDir = 0; this.diveHeight = 0; this.celebrateT = 0; this.celebrateType = 'aeroplano';
    this.tackleT = 0; this.stunT = 0; this.cooldown = 0; this.saveIntent = false; this.holdT = 0;
    this.base = new THREE.Vector3();
    this.buildMesh(kit);
  }

  buildMesh(kit) {
    const i = this.info;
    const root = new THREE.Group();
    const body = new THREE.Group(); // ruota per tuffi/scivolate
    root.add(body);
    const skin = new THREE.MeshLambertMaterial({ color: i.skin });
    const isGK = this.isKeeper;
    const kitUse = isGK ? { pattern: 'plain', c1: this.team === 0 ? '#ffb000' : '#18c3a0', c2: '#222222', shorts: '#222222', socks: this.team === 0 ? '#ffb000' : '#18c3a0' } : kit;
    const tx = new THREE.CanvasTexture(shirtCanvas(kitUse, i.number));
    tx.colorSpace = THREE.SRGBColorSpace;
    const shirt = new THREE.MeshLambertMaterial({ map: tx });
    const sleeve = new THREE.MeshLambertMaterial({ color: kitUse.c1 });
    const shorts = new THREE.MeshLambertMaterial({ color: kitUse.shorts });
    const socks = new THREE.MeshLambertMaterial({ color: kitUse.socks });
    const boots = new THREE.MeshLambertMaterial({ color: this.team === 0 ? '#ff3b6b' : '#222831' });
    const hair = new THREE.MeshLambertMaterial({ color: i.hair });
    const black = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const white = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const hips = new THREE.Group(); hips.position.y = 0.82; body.add(hips);
    const torso = new THREE.Mesh(G('torso', () => new THREE.CylinderGeometry(0.25, 0.21, 0.56, 14, 1)), shirt);
    torso.position.y = 0.3; torso.rotation.y = Math.PI; // il numero va dietro
    hips.add(torso);
    const sh = new THREE.Mesh(G('shorts', () => new THREE.CylinderGeometry(0.22, 0.25, 0.22, 12)), shorts);
    sh.position.y = -0.02; hips.add(sh);
    const neck = new THREE.Mesh(G('neck', () => new THREE.CylinderGeometry(0.07, 0.08, 0.1, 8)), skin); neck.position.y = 0.62; hips.add(neck);
    const head = new THREE.Group(); head.position.y = 0.86; hips.add(head);
    head.add(new THREE.Mesh(G('head', () => new THREE.SphereGeometry(0.25, 16, 12)), skin));
    const hairM = new THREE.Mesh(G('hair', () => new THREE.SphereGeometry(0.265, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5)), hair);
    hairM.position.y = 0.02; hairM.rotation.x = -0.25; head.add(hairM);
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(G('eye', () => new THREE.SphereGeometry(0.055, 8, 6)), white); e.position.set(sx * 0.09, 0.03, 0.21); head.add(e);
      const p = new THREE.Mesh(G('pupil', () => new THREE.SphereGeometry(0.03, 6, 4)), black); p.position.set(sx * 0.09, 0.03, 0.26); head.add(p);
    }
    const smile = new THREE.Mesh(G('smile', () => new THREE.TorusGeometry(0.07, 0.015, 4, 10, Math.PI)), black);
    smile.position.set(0, -0.08, 0.225); smile.rotation.z = Math.PI; head.add(smile);
    this.arms = [];
    for (const sx of [-1, 1]) {
      const sp = new THREE.Group(); sp.position.set(sx * 0.31, 0.52, 0); hips.add(sp);
      const up = new THREE.Mesh(G('uarm', () => { const g = new THREE.CylinderGeometry(0.075, 0.07, 0.26, 8); g.translate(0, -0.13, 0); return g; }), sleeve);
      sp.add(up);
      const fa = new THREE.Mesh(G('farm', () => { const g = new THREE.CylinderGeometry(0.06, 0.055, 0.28, 8); g.translate(0, -0.38, 0); return g; }), isGK ? sleeve : skin);
      sp.add(fa);
      const hand = new THREE.Mesh(G('hand'+isGK, () => { const g = new THREE.SphereGeometry(isGK ? 0.09 : 0.065, 8, 6); g.translate(0, -0.55, 0); return g; }), isGK ? new THREE.MeshLambertMaterial({ color: '#ffffff' }) : skin);
      sp.add(hand);
      this.arms.push(sp);
    }
    this.legs = [];
    for (const sx of [-1, 1]) {
      const lp = new THREE.Group(); lp.position.set(sx * 0.12, 0.8, 0); body.add(lp);
      const thigh = new THREE.Mesh(G('thigh', () => { const g = new THREE.CylinderGeometry(0.085, 0.075, 0.38, 8); g.translate(0, -0.19, 0); return g; }), skin);
      lp.add(thigh);
      const sock = new THREE.Mesh(G('sock', () => { const g = new THREE.CylinderGeometry(0.075, 0.065, 0.36, 8); g.translate(0, -0.56, 0); return g; }), socks);
      lp.add(sock);
      const boot = new THREE.Mesh(G('boot', () => { const g = new THREE.BoxGeometry(0.13, 0.09, 0.27); g.translate(0, -0.75, 0.05); return g; }), boots);
      lp.add(boot);
      this.legs.push(lp);
    }
    const shadow = makeShadow(1.3);
    root.add(shadow);
    this.shadow = shadow;
    root.scale.setScalar(1.25 * i.height * (isGK ? 1.06 : 1));
    this.root = root; this.bodyG = body; this.hips = hips; this.head = head;
  }

  // posa e animazione procedurale
  animate(dt) {
    const sp = Math.hypot(this.vel.x, this.vel.z);
    const r = this.root, b = this.bodyG;
    r.position.set(this.pos.x, 0, this.pos.z);
    r.rotation.y = this.facing;
    b.rotation.set(0, 0, 0); b.position.set(0, 0, 0);
    this.runPhase += dt * (4 + sp * 1.55);
    const run = Math.min(1, sp / 6);
    const s = Math.sin(this.runPhase);
    let legL = s * 0.9 * run, legR = -s * 0.9 * run;
    let armL = -s * 0.8 * run, armR = s * 0.8 * run, armLz = 0.12, armRz = -0.12;
    let bob = Math.abs(Math.cos(this.runPhase)) * 0.06 * run;
    b.rotation.x = 0.12 * run;
    // idle: respiro
    if (sp < 0.3) { armL = 0.05 * Math.sin(this.runPhase * 0.3); armR = -armL; }
    if (this.kickT > 0) {
      const k = 1 - this.kickT / 0.35; // 0..1
      const swing = k < 0.4 ? -1.1 * (k / 0.4) : -1.1 + 2.6 * Math.min(1, (k - 0.4) / 0.35);
      legR = -swing; legL = 0.2; armL = -0.9; armR = 0.6; armLz = 0.5;
      b.rotation.x = -0.1;
    }
    if (this.tackleT > 0) {
      b.rotation.x = -0.9; b.position.y = -0.35; legR = -1.3; legL = -0.6; armL = 0.4; armR = -0.4; bob = 0;
    }
    if (this.diveT > 0) {
      const k = Math.min(1, (0.9 - this.diveT) / 0.25);
      b.rotation.z = -this.diveDir * 1.35 * k;
      b.position.y = this.diveHeight * Math.sin(Math.min(1, k) * Math.PI * 0.5) * 0.9;
      armLz = 2.6; armRz = -2.6; armL = 0; armR = 0; legL = 0.3; legR = -0.2; bob = 0;
    } else if (this.isKeeper && this.holdT > 0) {
      armL = -1.3; armR = -1.3; armLz = 0.2; armRz = -0.2;
    } else if (this.isKeeper && sp < 2) {
      armLz = 0.6; armRz = -0.6; armL = -0.3; armR = -0.3; b.rotation.x = 0.15;
    }
    if (this.celebrateT > 0) {
      const t = this.celebrateT;
      switch (this.celebrateType) {
        case 'salto':
          bob = Math.abs(Math.sin(t * 6)) * 0.8; armL = armR = -3.0; armLz = 0.3; armRz = -0.3; break;
        case 'capriola':
          b.position.y = Math.max(0, Math.sin(t * 3.2)) * 0.9;
          b.rotation.x = Math.sin(t * 3.2) > 0 ? (t * 3.2 % (Math.PI * 2)) * 1.0 : 0;
          armL = armR = -2.6; break;
        case 'ballo':
          r.rotation.y = this.facing + t * 6; bob = Math.abs(Math.sin(t * 10)) * 0.15;
          armL = Math.sin(t * 10) * 1.5; armR = -armL; armLz = 1.2; armRz = -1.2; legL = Math.sin(t * 10) * 0.4; legR = -legL; break;
        default: // aeroplano
          armLz = 1.5; armRz = -1.5; armL = armR = 0; b.rotation.z = Math.sin(t * 3) * 0.3; break;
      }
    }
    if (this.stunT > 0) { b.rotation.x = -0.25; }
    b.position.y += bob;
    this.legs[0].rotation.x = legL; this.legs[1].rotation.x = legR;
    this.arms[0].rotation.x = armL; this.arms[1].rotation.x = armR;
    this.arms[0].rotation.z = -armLz; this.arms[1].rotation.z = -armRz;
    this.shadow.position.y = 0.02 - b.position.y; // l'ombra resta a terra
  }

  // stato compatto per i replay
  pose() {
    const b = this.bodyG;
    return [this.pos.x, this.pos.z, this.root.rotation.y, b.rotation.x, b.rotation.z, b.position.y,
      this.legs[0].rotation.x, this.legs[1].rotation.x, this.arms[0].rotation.x, this.arms[1].rotation.x,
      this.arms[0].rotation.z, this.arms[1].rotation.z];
  }
  applyPose(p) {
    const b = this.bodyG;
    this.root.position.set(p[0], 0, p[1]); this.root.rotation.y = p[2];
    b.rotation.set(p[3], 0, p[4]); b.position.set(0, p[5], 0);
    this.legs[0].rotation.x = p[6]; this.legs[1].rotation.x = p[7];
    this.arms[0].rotation.x = p[8]; this.arms[1].rotation.x = p[9];
    this.arms[0].rotation.z = p[10]; this.arms[1].rotation.z = p[11];
    this.shadow.position.y = 0.02 - p[5];
  }
  dir() { return new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing)); }
}

// ---------------------------------------------------------------------------------
export const BALL_R = 0.2;
const GRAV = 11;

export class Ball {
  constructor() {
    this.pos = new THREE.Vector3(0, BALL_R, 0);
    this.vel = new THREE.Vector3();
    this.owner = null; this.lastTouch = null; this.lastKickTeam = -1;
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 20, 14), new THREE.MeshLambertMaterial({ map: ballTexture() }));
    this.shadow = makeShadow(0.7);
    this.trail = 0;
    this.events = []; // 'bounce' | 'post'
    this.inNet = 0;   // lato della porta se la palla è nella rete
  }

  kick(vel, by) {
    this.owner = null;
    this.kickId = (this.kickId || 0) + 1;
    this.vel.copy(vel);
    this.lastTouch = by; this.lastKickTeam = by ? by.team : -1;
    if (by) by.cooldown = 0.35;
  }

  step(dt) {
    if (this.owner) return;
    const p = this.pos, v = this.vel;
    v.y -= GRAV * dt;
    // attrito dell'aria
    const air = 1 - 0.12 * dt;
    v.x *= air; v.z *= air;
    p.addScaledVector(v, dt);
    if (p.y < BALL_R) {
      p.y = BALL_R;
      if (v.y < -1.2) { this.events.push(['bounce', Math.min(1, -v.y / 8)]); v.y = -v.y * 0.55; v.x *= 0.88; v.z *= 0.88; }
      else v.y = 0;
    }
    if (p.y <= BALL_R + 0.01 && Math.abs(v.y) < 0.01) {
      // attrito sull'erba (rotolamento)
      const f = Math.max(0, 1 - 0.95 * dt);
      v.x *= f; v.z *= f;
      if (Math.hypot(v.x, v.z) < 0.08) { v.x = 0; v.z = 0; }
    }
    this.collideGoals();
  }

  collideGoals() {
    const { HL, GOAL_W, GOAL_H, GOAL_D } = FIELD;
    const p = this.pos, v = this.vel;
    for (const s of [-1, 1]) {
      const gx = s * HL;
      if (Math.abs(p.x - gx) > GOAL_D + 1.5) continue;
      // pali
      for (const z of [-GOAL_W, GOAL_W]) {
        if (p.y < GOAL_H + BALL_R) this.collideCyl(p.x - gx, p.z - z, 0.08, 'xz');
      }
      // traversa (asse z)
      if (Math.abs(p.z) < GOAL_W) this.collideCyl(p.x - gx, p.y - GOAL_H, 0.08, 'xy');
      // dentro la rete
      const inside = s * (p.x - gx) > 0 && Math.abs(p.z) < GOAL_W + 0.1 && p.y < GOAL_H + 0.1;
      if (inside) {
        this.inNet = s;
        const back = gx + s * (GOAL_D - BALL_R);
        if (s * (p.x - back) > 0) { p.x = back; v.x *= -0.15; v.z *= 0.5; }
        if (Math.abs(p.z) > GOAL_W - BALL_R) { p.z = Math.sign(p.z) * (GOAL_W - BALL_R); v.z *= -0.2; }
        if (p.y > GOAL_H - BALL_R) { p.y = GOAL_H - BALL_R; v.y = -Math.abs(v.y) * 0.2; }
        v.x *= 0.96; v.z *= 0.96;
      } else if (s * (p.x - gx) > 0 && s * (p.x - gx) < GOAL_D + BALL_R && p.y < GOAL_H + BALL_R) {
        // rete laterale/superiore dall'esterno
        if (Math.abs(p.z) < GOAL_W + BALL_R + 0.05 && Math.abs(p.z) > GOAL_W) { v.z *= -0.2; p.z = Math.sign(p.z) * (GOAL_W + BALL_R + 0.05); v.x *= 0.5; }
        else if (Math.abs(p.z) < GOAL_W && p.y > GOAL_H) { v.y = Math.abs(v.y) * 0.2; v.x *= 0.5; }
      }
    }
  }

  // collisione con un cilindro infinito; a,b coordinate relative nel piano perpendicolare all'asse
  collideCyl(a, b, r, plane) {
    const d = Math.hypot(a, b), min = r + BALL_R;
    if (d >= min || d < 1e-4) return;
    const nx = a / d, nb = b / d;
    const v = this.vel;
    const va = v.x, vb = plane === 'xz' ? v.z : v.y;
    const dot = va * nx + vb * nb;
    if (dot >= 0) return;
    const e = 0.7;
    const na = va - (1 + e) * dot * nx, nbv = vb - (1 + e) * dot * nb;
    v.x = na; if (plane === 'xz') v.z = nbv; else v.y = nbv;
    const push = min - d;
    this.pos.x += nx * push; if (plane === 'xz') this.pos.z += nb * push; else this.pos.y += nb * push;
    if (-dot > 2) this.events.push(['post', 1]);
  }

  sync(dt) {
    const m = this.mesh;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    m.position.copy(this.pos);
    if (sp > 0.05) {
      const ax = new THREE.Vector3(this.vel.z, 0, -this.vel.x).normalize();
      m.rotateOnWorldAxis(ax, sp * dt / BALL_R);
    }
    this.shadow.position.set(this.pos.x, 0.025, this.pos.z);
    const h = Math.max(0, this.pos.y - BALL_R);
    const sc = 0.7 * (1 + h * 0.15);
    this.shadow.scale.set(sc, sc, 1);
    this.shadow.material.opacity = Math.max(0.25, 1 - h * 0.2);
  }
}

let ballTex = null;
function ballTexture() {
  if (ballTex) return ballTex;
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 128);
  // pannelli colorati stile pallone moderno
  const cols = ['#ff3b6b', '#1f6bff', '#ffcf1f', '#ff3b6b', '#1f6bff', '#ffcf1f'];
  for (let i = 0; i < 12; i++) {
    const x = (i % 6) * 43 + (i > 5 ? 21 : 0), y = i > 5 ? 88 : 36;
    g.fillStyle = i % 2 ? '#1b1b2b' : cols[i % 6];
    g.beginPath();
    for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * Math.PI * 2 / 5; g.lineTo(x + Math.cos(a) * 13, y + Math.sin(a) * 13 * 0.9); }
    g.closePath(); g.fill();
  }
  ballTex = new THREE.CanvasTexture(c);
  ballTex.colorSpace = THREE.SRGBColorSpace;
  return ballTex;
}
