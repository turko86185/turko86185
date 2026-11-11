// Base comune a partita, rigori e allenamento: ciclo di gioco a passo fisso, camera, portiere, tiri, effetti.
import * as THREE from '../vendor/three.module.min.js';
import { World, FIELD } from './world.js';
import { Ball, BALL_R, Player } from './actors.js';
import { input, shootCharge } from '../controls.js';
import * as Audio from '../audio.js';

export { THREE, FIELD, BALL_R, input };
export const DIFF = {
  facile:    { aiSpeed: 0.76, tackle: 0.22, aiShotErr: 1.3, gkSave: 0.56, mateTackle: 0.045, gkReach: 1.6, react: 0.5 },
  normale:   { aiSpeed: 0.88, tackle: 0.36, aiShotErr: 0.9, gkSave: 0.62, mateTackle: 0.08, gkReach: 2.0, react: 0.35 },
  difficile: { aiSpeed: 0.98, tackle: 0.5,  aiShotErr: 0.6, gkSave: 0.74, mateTackle: 0.12,  gkReach: 2.4, react: 0.22 }
};

export class BaseGame {
  constructor(renderer, opts, hud) {
    this.renderer = renderer; this.opts = opts; this.hud = hud;
    this.diff = DIFF[opts.difficulty] || DIFF.facile;
    this.assisted = !!opts.assisted;
    this.world = new World(renderer, {
      stadium: opts.stadium, quality: opts.quality,
      homeColors: [opts.kits[0].c1, opts.kits[0].c2], awayColors: [opts.kits[1].c1, opts.kits[1].c2],
      homeShort: opts.home.short, awayShort: opts.away?.short || 'CPU'
    });
    this.scene = this.world.scene;
    this.camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.3, 700);
    this.camPos = new THREE.Vector3(0, 18, 34); this.camLook = new THREE.Vector3();
    this.ball = new Ball();
    this.scene.add(this.ball.mesh, this.ball.shadow);
    this.players = [];
    this.paused = false; this.running = false; this.acc = 0; this.frame = 0;
    this.timeScale = 1;
    this.particles = [];
    this.buildIndicator();
    this.resize();
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
  }

  buildIndicator() {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.78, 28), new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.95, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.renderOrder = 2;
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 4), new THREE.MeshBasicMaterial({ color: 0xffe14d }));
    arrow.rotation.x = Math.PI;
    // nome sopra la testa
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(20,24,60,0.75)'; roundRect(g, 18, 6, 220, 52, 26); g.fill();
    g.fillStyle = '#ffe14d'; g.font = 'bold 38px Fredoka, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('ANDREA', 128, 34);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
    label.scale.set(2.6, 0.65, 1); label.renderOrder = 10;
    this.indicator = { ring, arrow, label };
    this.scene.add(ring, arrow, label);
  }
  placeIndicator(p, t) {
    const { ring, arrow, label } = this.indicator;
    const vis = !!p;
    ring.visible = arrow.visible = label.visible = vis;
    if (!vis) return;
    ring.position.set(p.pos.x, 0.04, p.pos.z);
    const s = 1 + Math.sin(t * 6) * 0.06; ring.scale.set(s, s, 1);
    arrow.position.set(p.pos.x, 2.95 + Math.sin(t * 5) * 0.1, p.pos.z);
    arrow.rotation.y = t * 2;
    label.position.set(p.pos.x, 3.6, p.pos.z);
  }

  resize() {
    const c = this.renderer.domElement;
    const w = c.clientWidth || window.innerWidth, h = c.clientHeight || window.innerHeight;
    const prCap = this.opts.quality === 'alta' ? 2 : this.opts.quality === 'media' ? 1.5 : 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, prCap));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // su schermi stretti (verticale) allarga il campo visivo
    this.camera.fov = w / h < 1.2 ? 58 : 40;
    this.camera.updateProjectionMatrix();
  }

  addPlayer(info, kit, team, isKeeper) {
    const p = new Player(info, kit, team, isKeeper);
    this.players.push(p);
    this.scene.add(p.root);
    return p;
  }

  start() {
    this.running = true;
    let last = performance.now();
    const STEP = 1 / 60;
    const lowPower = this.opts.quality === 'bassa';
    this.renderer.setAnimationLoop(now => {
      let dt = Math.min(0.1, (now - last) / 1000);
      if (lowPower && dt < 1 / 40) return; // risparmio batteria: ~30 fps
      last = now;
      if (!this.paused) {
        this.acc += dt * this.timeScale;
        let n = 0;
        while (this.acc >= STEP && n < 5) { this.fixed(STEP); this.acc -= STEP; n++; this.frame++; }
        if (n === 5) this.acc = 0;
        this.visual(dt * this.timeScale);
        this.world.update(dt * this.timeScale);
        this.updateParticles(dt * this.timeScale);
      }
      this.renderer.render(this.scene, this.camera);
      input.clearEdges();
    });
  }
  stop() { this.running = false; this.renderer.setAnimationLoop(null); }
  dispose() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
    this.world.dispose();
    Audio.crowdStop();
  }
  pause(v) { this.paused = v; }

  // ----- da implementare nelle sottoclassi -----
  fixed(dt) {}
  visual(dt) {}

  // ---------- utilità di gioco ----------
  moveTowards(p, tx, tz, speed, dt, accel = 22) {
    const dx = tx - p.pos.x, dz = tz - p.pos.z;
    const d = Math.hypot(dx, dz);
    let vx = 0, vz = 0;
    if (d > 0.15) { const s = Math.min(speed, d * 3); vx = dx / d * s; vz = dz / d * s; }
    this.steer(p, vx, vz, dt, accel);
  }
  steer(p, vx, vz, dt, accel = 22) {
    const k = Math.min(1, accel * dt / Math.max(0.5, Math.hypot(vx - p.vel.x, vz - p.vel.z)));
    p.vel.x += (vx - p.vel.x) * Math.min(1, k * 2.2);
    p.vel.z += (vz - p.vel.z) * Math.min(1, k * 2.2);
    p.pos.x += p.vel.x * dt; p.pos.z += p.vel.z * dt;
    const sp = Math.hypot(p.vel.x, p.vel.z);
    if (sp > 0.6) turnTo(p, Math.atan2(p.vel.x, p.vel.z), dt * 12);
    p.pos.x = clamp(p.pos.x, -FIELD.HL - 2.5, FIELD.HL + 2.5);
    p.pos.z = clamp(p.pos.z, -FIELD.HW - 2.5, FIELD.HW + 2.5);
  }
  face(p, x, z, dt) { turnTo(p, Math.atan2(x - p.pos.x, z - p.pos.z), dt * 10); }

  separate() {
    const ps = this.players;
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], b = ps[j];
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.9 && d > 1e-3) {
        const push = (0.9 - d) / 2;
        a.pos.x -= dx / d * push; a.pos.z -= dz / d * push;
        b.pos.x += dx / d * push; b.pos.z += dz / d * push;
      }
    }
  }

  // il possessore porta la palla tra i piedi
  dribble(p, dt) {
    const b = this.ball;
    const d = p.dir();
    const tx = p.pos.x + d.x * 0.72, tz = p.pos.z + d.z * 0.72;
    const k = Math.min(1, dt * 18);
    b.pos.x += (tx - b.pos.x) * k; b.pos.z += (tz - b.pos.z) * k; b.pos.y = BALL_R;
    b.vel.set(p.vel.x, 0, p.vel.z);
  }

  // calcola la velocità per un tiro verso un punto (x,y,z) a una certa velocità orizzontale
  shotVelocity(from, tx, ty, tz, speed) {
    const dx = tx - from.x, dz = tz - from.z;
    const d = Math.hypot(dx, dz);
    const t = d / speed;
    const vy = (ty - from.y + 0.5 * 11 * t * t) / t;
    // compensazione per l'attrito dell'aria
    const comp = 1 + 0.06 * t;
    return new THREE.Vector3(dx / d * speed * comp, vy, dz / d * speed * comp);
  }

  passVelocity(from, to, lofted = false) {
    const dx = to.x - from.x, dz = to.z - from.z;
    const d = Math.hypot(dx, dz) || 1;
    if (lofted) {
      const sp = clamp(d * 0.75 + 6, 9, 20);
      return this.shotVelocity(from, to.x, 0.3, to.z, sp);
    }
    const sp = clamp(d * 0.95 + 4.5, 7, 23);
    return new THREE.Vector3(dx / d * sp, 0, dz / d * sp);
  }

  doKick(p, vel, power = 0.6) {
    p.kickT = 0.35;
    this.ball.kick(vel, p);
    Audio.sfx('kick', power);
  }

  // ---------- PORTIERE ----------
  // gk: Player, goalX: x della linea di porta, out: +1/-1 direzione verso il campo
  keeperThink(gk, goalX, out, dt, params) {
    const b = this.ball;
    gk.diveT = Math.max(0, gk.diveT - dt);
    gk.ignoreT = Math.max(0, (gk.ignoreT || 0) - dt);
    if (b.owner === gk) return;
    const toward = -out * b.vel.x; // velocità verso la porta
    if (!b.owner && b.lastKickTeam !== gk.team && toward > 5 && gk.shotId !== b.kickId) {
      const t = (goalX - b.pos.x) / b.vel.x;
      if (t > 0 && t < 3) {
        gk.shotId = b.kickId;
        const pz = b.pos.z + b.vel.z * t;
        let py = b.pos.y + b.vel.y * t - 0.5 * 11 * t * t;
        if (py < BALL_R) py = 0.4;
        const onTarget = Math.abs(pz) < FIELD.GOAL_W + 0.5 && py < FIELD.GOAL_H + 0.5;
        if (onTarget) {
          const dist = Math.abs(pz - gk.pos.z) + Math.max(0, py - 1.6) * 0.8;
          const speed = Math.hypot(b.vel.x, b.vel.z);
          let chance = params.save - Math.max(0, speed - 19) * 0.02 - Math.max(0, dist - 1.6) * 0.08;
          if (dist < 0.9) chance += 0.3;
          if (params.forceSave != null) chance = params.forceSave ? 1 : 0;
          const reach = params.reach;
          const save = Math.random() < chance && dist < reach + 0.6;
          gk.saveIntent = save;
          gk.plan = { z: save ? pz : pz + Math.sign(pz - gk.pos.z || 1) * -(0.9 + Math.random() * 0.6) * (Math.random() < 0.5 ? 1 : -1.6), y: py, t, x: goalX + out * 0.45 };
          if (!save) gk.ignoreT = t + 0.6;
          const lateral = gk.plan.z - gk.pos.z;
          if (Math.abs(lateral) > 0.7 || py > 1.7) {
            // tuffo: direzione relativa al corpo del portiere (rivolto verso il campo)
            gk.diveT = 0.9;
            gk.diveDir = Math.sign(lateral * (out > 0 ? -1 : 1)) || 1;
            gk.diveHeight = clamp((py - 0.6) * 0.6, 0, 0.9);
          }
        }
      }
    }
    if (gk.plan && gk.plan.t > -0.6) {
      gk.plan.t -= dt;
      const sp = gk.diveT > 0 ? 11 : 7;
      this.moveTowards(gk, gk.plan.x, gk.plan.z, sp, dt, 60);
      gk.facing = out > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (gk.plan.t <= -0.6) gk.plan = null;
      return;
    }
    if (gk.diveT > 0) { gk.vel.multiplyScalar(0.9); return; }
    // posizionamento: sulla bisettrice tra palla e porta
    const dxb = b.pos.x - goalX, dzb = b.pos.z;
    const db = Math.hypot(dxb, dzb) || 1;
    const adv = clamp(db * 0.12, 0.6, 2.4);
    let tx = goalX + dxb / db * adv, tz = clamp(dzb / db * adv * 1.6, -FIELD.GOAL_W + 0.5, FIELD.GOAL_W - 0.5);
    // esce sulla palla vagante vicina
    if (params.rush && !b.owner && Math.abs(b.pos.x - goalX) < 8 && Math.abs(b.pos.z) < 9 && Math.hypot(b.vel.x, b.vel.z) < 9) { tx = b.pos.x; tz = b.pos.z; }
    this.moveTowards(gk, tx, tz, 6.5 * params.speed, dt);
    if (Math.hypot(gk.vel.x, gk.vel.z) < 1) this.face(gk, b.pos.x, b.pos.z, dt);
  }

  // controllo contatto palla-portiere. ritorna 'catch' | 'parry' | null
  keeperContact(gk, out) {
    const b = this.ball;
    if (b.owner || gk.ignoreT > 0 || b.lastTouch === gk) return null;
    const handY = gk.diveT > 0 ? 0.5 + gk.diveHeight * 1.4 : 1.1;
    const dx = b.pos.x - gk.pos.x, dz = b.pos.z - gk.pos.z;
    const horiz = Math.hypot(dx, dz);
    const reachH = gk.diveT > 0 ? 1.15 : 0.75;
    if (horiz > reachH || b.pos.y > (gk.diveT > 0 ? handY + 0.9 : 2.45)) return null;
    const sp = b.vel.length();
    if (sp < 16 || Math.random() < 0.45) {
      b.owner = gk; b.vel.set(0, 0, 0); b.lastTouch = gk; b.lastKickTeam = gk.team;
      gk.holdT = 1.4;
      b.pos.set(gk.pos.x + out * 0.4, 1.0, gk.pos.z);
      Audio.sfx('save');
      return 'catch';
    }
    // respinta
    b.vel.set(out * (4 + Math.random() * 5), 2.5 + Math.random() * 3, (Math.random() - 0.5) * 10);
    b.pos.x = gk.pos.x + out * 0.6;
    b.lastTouch = gk; b.lastKickTeam = gk.team; b.kickId = (b.kickId || 0) + 1;
    gk.cooldown = 0.5;
    Audio.sfx('save');
    return 'parry';
  }

  // ---------- CAMERA ----------
  broadcastCam(dt, focus, zoom = 1) {
    const tx = clamp(focus.x, -FIELD.HL + 7, FIELD.HL - 7);
    const aspect = this.camera.aspect;
    const far = aspect < 1.2 ? 1.25 : 1;
    const want = new THREE.Vector3(tx, 12.5 * zoom * far, 22 * zoom * far + focus.z * 0.55);
    const look = new THREE.Vector3(tx, 0, focus.z * 0.7 - 1.5);
    this.camPos.lerp(want, Math.min(1, dt * 3));
    this.camLook.lerp(look, Math.min(1, dt * 4));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }
  setCam(pos, look, dt, speed = 3) {
    this.camPos.lerp(pos, Math.min(1, dt * speed));
    this.camLook.lerp(look, Math.min(1, dt * speed * 1.3));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }
  snapCam(pos, look) { this.camPos.copy(pos); this.camLook.copy(look); this.camera.position.copy(pos); this.camera.lookAt(look); }

  // ---------- EFFETTI: coriandoli e fuochi ----------
  confetti(x, z, colors, n = 160) {
    const geo = new THREE.PlaneGeometry(0.18, 0.12);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide }));
      m.position.set(x + (Math.random() - 0.5) * 6, 6 + Math.random() * 6, z + (Math.random() - 0.5) * 6);
      m.userData = { v: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4), r: new THREE.Vector3(Math.random() * 8, Math.random() * 8, 0), life: 4 + Math.random() * 2 };
      this.scene.add(m); this.particles.push(m);
    }
  }
  firework(x, y, z, color) {
    const n = 60;
    const pos = new Float32Array(n * 3), vel = [];
    for (let i = 0; i < n; i++) {
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI - Math.PI / 2, s = 6 + Math.random() * 4;
      vel.push(new THREE.Vector3(Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + 2, Math.sin(a) * Math.cos(e) * s));
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size: 0.5, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    pts.userData = { fw: true, vel, life: 1.8 };
    this.scene.add(pts); this.particles.push(pts);
    Audio.sfx('pop');
  }
  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const m = this.particles[i], u = m.userData;
      u.life -= dt;
      if (u.fw) {
        const a = m.geometry.attributes.position.array;
        u.vel.forEach((v, k) => { v.y -= 6 * dt; v.multiplyScalar(1 - dt * 1.2); a[k * 3] += v.x * dt; a[k * 3 + 1] += v.y * dt; a[k * 3 + 2] += v.z * dt; });
        m.geometry.attributes.position.needsUpdate = true;
        m.material.opacity = Math.max(0, u.life / 1.8);
      } else {
        u.v.y = Math.max(-1.5, u.v.y - 3 * dt);
        m.position.addScaledVector(u.v, dt);
        m.rotation.x += u.r.x * dt; m.rotation.y += u.r.y * dt;
      }
      if (u.life <= 0 || m.position.y < 0) {
        this.scene.remove(m); m.geometry.dispose(); m.material.dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  // input del joystick in coordinate mondo (camera laterale: destra = +x, su = -z)
  joyWorld() {
    return { x: input.x, z: input.y, m: Math.min(1, Math.hypot(input.x, input.y)) };
  }
  charge() { return shootCharge(); }
}

export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
export function turnTo(p, ang, k) {
  let d = ang - p.facing;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  p.facing += d * Math.min(1, k);
}
export function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
