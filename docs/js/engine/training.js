// ALLENAMENTO: tiri in porta, passaggi, dribbling (slalom), percorso a ostacoli con stelle, bersagli.
import { BaseGame, THREE, FIELD, BALL_R, input, clamp, rand, pick } from './core.js';
import * as Audio from '../audio.js';

const HL = FIELD.HL;

export const DRILLS = [
  { id: 'tiri',      name: 'Tiri in porta',        desc: '10 tiri contro il portiere', medals: [3, 5, 7], unit: 'gol' },
  { id: 'passaggi',  name: 'Passaggi',             desc: 'Passa al compagno illuminato: 60 secondi', medals: [4, 7, 10], unit: 'passaggi' },
  { id: 'dribbling', name: 'Dribbling',            desc: 'Slalom tra i coni più veloce che puoi', medals: [50, 35, 25], unit: 'secondi', lower: true },
  { id: 'percorso',  name: 'Percorso a ostacoli',  desc: 'Raccogli tutte le stelle con la palla', medals: [70, 50, 35], unit: 'secondi', lower: true },
  { id: 'bersagli',  name: 'Colpisci i bersagli',  desc: '10 tiri per colpire 5 bersagli', medals: [2, 3, 5], unit: 'bersagli' },
  { id: 'rigori',    name: 'Rigori',               desc: '10 rigori per allenarti', medals: [4, 6, 8], unit: 'gol' }
];

export function medalFor(drill, score) {
  const d = DRILLS.find(x => x.id === drill);
  const [b, s, g] = d.medals;
  if (d.lower) return score <= g ? 'oro' : score <= s ? 'argento' : score <= b ? 'bronzo' : null;
  return score >= g ? 'oro' : score >= s ? 'argento' : score >= b ? 'bronzo' : null;
}

export class TrainingGame extends BaseGame {
  constructor(renderer, opts, hud) {
    super(renderer, opts, hud);
    this.drill = opts.drill;
    this.t = 0; this.score = 0; this.attempt = 0; this.timer = 0; this.done = false;
    const r = opts.rosters[0];
    this.andrea = this.addPlayer(r[5], opts.kits[0], 0, false);
    this.mates = []; this.objects = []; this.targets = []; this.stars = []; this.gates = [];
    this.phase = 'ready'; this.phaseT = 0;
    Audio.crowdStart(); Audio.crowdSet(0.12);
    const setup = { tiri: () => this.setupShots(), passaggi: () => this.setupPasses(), dribbling: () => this.setupSlalom(), percorso: () => this.setupCourse(), bersagli: () => this.setupTargets() };
    setup[this.drill]();
    this.hud.score(0, null);
    const d = DRILLS.find(x => x.id === this.drill);
    this.hud.banner(d.name + '!', 2000);
    this.hud.hint(d.desc);
    this.snapCam(new THREE.Vector3(this.andrea.pos.x - 8, 6, this.andrea.pos.z + 10), this.andrea.pos.clone());
  }

  // ---------- configurazioni ----------
  setupShots() {
    this.gk = this.addPlayer(this.opts.rosters[1][0], this.opts.kits[1], 1, true);
    this.maxAttempts = 10;
    this.placeShot();
  }
  placeShot() {
    const x = rand(HL - 21, HL - 12), z = rand(-9, 9);
    this.ball.owner = null; this.ball.vel.set(0, 0, 0); this.ball.pos.set(x, BALL_R, z); this.ball.inNet = 0; this.ball.lastKickTeam = -1;
    this.andrea.pos.set(x - 1.2, 0, z); this.andrea.vel.set(0, 0, 0); this.andrea.facing = Math.PI / 2;
    this.gk.pos.set(HL - 0.6, 0, 0); this.gk.vel.set(0, 0, 0); this.gk.diveT = 0; this.gk.plan = null; this.gk.ignoreT = 0; this.gk.holdT = 0;
    this.shotState = 'free'; this.shotT = 0; this.shotResult = null;
  }

  setupPasses() {
    this.timer = 60;
    const spots = [[HL - 18, -11], [HL - 6, 0], [HL - 18, 11], [HL - 30, 0]];
    const r = this.opts.rosters[0];
    spots.forEach((s, i) => {
      const m = this.addPlayer(r[i + 1], this.opts.kits[0], 0, false);
      m.pos.set(s[0], 0, s[1]); m.home = new THREE.Vector3(s[0], 0, s[1]);
      this.mates.push(m);
    });
    this.andrea.pos.set(HL - 18, 0, 0);
    this.ball.pos.set(HL - 17.4, BALL_R, 0); this.ball.owner = this.andrea;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 1.0, 28), new THREE.MeshBasicMaterial({ color: 0x5dff8a, transparent: true, opacity: 0.9, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; this.scene.add(ring); this.passRing = ring;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 6, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x5dff8a, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
    this.scene.add(beam); this.passBeam = beam;
    this.highlight = 1;
  }

  setupSlalom() {
    const coneGeo = new THREE.ConeGeometry(0.3, 0.7, 12);
    const coneMat = [new THREE.MeshLambertMaterial({ color: 0xff7a1a }), new THREE.MeshLambertMaterial({ color: 0xffd23f })];
    this.andrea.pos.set(-20, 0, 0); this.andrea.facing = Math.PI / 2;
    this.ball.pos.set(-19.4, BALL_R, 0); this.ball.owner = this.andrea;
    for (let i = 0; i < 8; i++) {
      const x = -14 + i * 5, z = i % 2 ? 3 : -3;
      for (const dz of [-1.6, 1.6]) {
        const c = new THREE.Mesh(coneGeo, coneMat[i % 2]); c.position.set(x, 0.35, z + dz); this.scene.add(c);
      }
      this.gates.push({ x, z, done: false });
    }
    this.addFinish(28);
    this.gateMarker();
  }
  gateMarker() {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.12, 8, 24), new THREE.MeshBasicMaterial({ color: 0x5dff8a }));
    m.rotation.y = Math.PI / 2; this.scene.add(m); this.gateMesh = m;
  }
  addFinish(x) {
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    for (const z of [-4, 4]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.2, 8), mat); p.position.set(x, 1.6, z); this.scene.add(p); }
    const c = document.createElement('canvas'); c.width = 256; c.height = 48;
    const g = c.getContext('2d');
    for (let i = 0; i < 16; i++) for (let j = 0; j < 3; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#fff'; g.fillRect(i * 16, j * 16, 16, 16); }
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), side: THREE.DoubleSide }));
    ban.position.set(x, 3, 0); ban.rotation.y = Math.PI / 2; this.scene.add(ban);
    this.finishX = x;
  }

  setupCourse() {
    this.andrea.pos.set(-26, 0, 0); this.andrea.facing = Math.PI / 2;
    this.ball.pos.set(-25.4, BALL_R, 0); this.ball.owner = this.andrea;
    // ostacoli: muretti colorati
    const cols = [0xff4f6d, 0x4fb3ff, 0xffd23f, 0x5dff8a, 0xc58cff];
    const walls = [[-18, 4, 1, 8], [-10, -5, 1, 9], [-2, 5, 1, 9], [6, -3, 7, 1], [14, 4, 1, 8], [20, -6, 6, 1]];
    this.walls = walls.map(([x, z, w, d], i) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1, d), new THREE.MeshLambertMaterial({ color: cols[i % cols.length] }));
      m.position.set(x, 0.5, z); this.scene.add(m);
      return { x, z, w, d };
    });
    const starPos = [[-18, -4], [-10, 6], [-2, -4], [6, 4], [10, -8], [14, -4], [22, 4], [26, -2]];
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.25 : 0.6; i ? shape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : shape.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const sg = new THREE.ExtrudeGeometry(shape, { depth: 0.15, bevelEnabled: false });
    const sm = new THREE.MeshLambertMaterial({ color: 0xffe14d, emissive: 0x806000 });
    this.stars = starPos.map(([x, z]) => { const m = new THREE.Mesh(sg, sm); m.position.set(x, 1, z); this.scene.add(m); return m; });
  }

  setupTargets() {
    this.maxAttempts = 10;
    const spots = [[-2.4, 0.6], [2.4, 0.6], [-2.4, 1.75], [2.4, 1.75], [0, 1.4]];
    const cols = [0xff4f6d, 0x4fb3ff, 0xffd23f, 0x5dff8a, 0xc58cff];
    this.targets = spots.map(([z, y], i) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.08, 8, 24), new THREE.MeshBasicMaterial({ color: cols[i] }));
      m.position.set(HL + 0.1, y, z); m.rotation.y = Math.PI / 2; this.scene.add(m);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), new THREE.MeshBasicMaterial({ color: cols[i], transparent: true, opacity: 0.3, side: THREE.DoubleSide }));
      disc.position.copy(m.position); disc.rotation.y = Math.PI / 2; this.scene.add(disc);
      return { m, disc, z, y, hit: false };
    });
    this.placeTargetShot();
  }
  placeTargetShot() {
    const x = HL - rand(11, 16), z = rand(-5, 5);
    this.ball.owner = null; this.ball.vel.set(0, 0, 0); this.ball.pos.set(x, BALL_R, z); this.ball.inNet = 0;
    this.andrea.pos.set(x - 1.2, 0, z); this.andrea.vel.set(0, 0, 0); this.andrea.facing = Math.PI / 2;
    this.shotState = 'free'; this.shotT = 0; this.crossed = false;
  }

  // ---------- ciclo ----------
  fixed(dt) {
    this.t += dt; this.phaseT += dt;
    const a = this.andrea, b = this.ball;
    a.kickT = Math.max(0, a.kickT - dt); a.cooldown = Math.max(0, a.cooldown - dt); a.celebrateT = Math.max(0, a.celebrateT - dt);
    if (this.phase === 'ready') { if (this.phaseT > 1.5) { this.phase = 'go'; this.phaseT = 0; Audio.sfx('whistle'); } return; }
    if (this.phase === 'end') { a.vel.multiplyScalar(0.9); if (!b.owner) b.step(dt); b.events.length = 0; if (this.phaseT > 3 && !this.done) { this.done = true; this.hud.end(this.summary()); } return; }
    // movimento di Andrea
    const j = this.joyWorld();
    let sp = 6.8 * (input.sprint || j.far ? 1.3 : 1) * (b.owner === a ? 0.95 : 1);
    let vx = j.x * sp, vz = j.z * sp;
    if (j.m < 0.2 && !b.owner && this.assisted && this.drill === 'passaggi') {
      const d = Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z);
      if (d > 0.4 && d < 20) { vx = (b.pos.x - a.pos.x) / d * sp * 0.8; vz = (b.pos.z - a.pos.z) / d * sp * 0.8; }
    }
    this.steer(a, vx, vz, dt, 18);
    if (this.walls) this.collideWalls(a);
    if (b.owner === a) this.dribble(a, dt);
    else if (b.owner && b.owner !== this.gk) this.dribble(b.owner, dt);
    else if (!b.owner) b.step(dt);
    for (const [ev, v] of b.events) { if (ev === 'bounce') Audio.sfx('bounce', v); if (ev === 'post') Audio.sfx('post'); }
    b.events.length = 0;
    // presa della palla
    if (!b.owner && a.cooldown <= 0 && b.pos.y < 1 && Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z) < (this.assisted ? 0.95 : 0.75)) {
      b.owner = a; b.lastTouch = a;
    }
    // azioni
    if (input.shoot && b.owner === a) this.shoot(input.shootPower);
    if (input.pass && b.owner === a) this.pass();
    this['step_' + this.drill](dt);
  }

  collideWalls(p) {
    for (const w of this.walls) {
      const hx = w.w / 2 + 0.35, hz = w.d / 2 + 0.35;
      const dx = p.pos.x - w.x, dz = p.pos.z - w.z;
      if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
        if (hx - Math.abs(dx) < hz - Math.abs(dz)) { p.pos.x = w.x + Math.sign(dx) * hx; p.vel.x = 0; }
        else { p.pos.z = w.z + Math.sign(dz) * hz; p.vel.z = 0; }
      }
    }
  }

  shoot(power) {
    const a = this.andrea, b = this.ball, j = this.joyWorld();
    power = Math.max(0.3, power);
    let tz, ty;
    if (this.drill === 'bersagli') {
      // mira al bersaglio più vicino alla direzione scelta
      const avail = this.targets.filter(t => !t.hit);
      let tgt = avail[0];
      if (avail.length) {
        const wantZ = Math.abs(j.z) > 0.3 ? Math.sign(j.z) * 2.4 : a.pos.z * 0.2;
        const wantY = 0.4 + power * 1.5;
        tgt = avail.reduce((m, t) => (Math.hypot(t.z - wantZ, t.y - wantY) < Math.hypot(m.z - wantZ, m.y - wantY) ? t : m), avail[0]);
        tz = tgt.z; ty = tgt.y;
      } else { tz = 0; ty = 1; }
      const err = this.assisted ? 0.25 : 0.55;
      tz += rand(-err, err); ty += rand(-err, err) * 0.7;
    } else {
      tz = Math.abs(j.z) > 0.3 ? Math.sign(j.z) * FIELD.GOAL_W * 0.72 : (this.gk && this.gk.pos.z > 0 ? -1 : 1) * FIELD.GOAL_W * 0.62;
      ty = Math.min(this.assisted ? 1.85 : 3, 0.35 + power * 1.3);
      const err = this.assisted ? 0.3 : 0.9; tz += rand(-err, err);
    }
    const v = this.shotVelocity(b.pos, HL + 0.6, ty, tz, 14 + power * 13);
    this.doKick(a, v, 0.6 + power * 0.4);
    this.shotState = 'flying'; this.shotT = 0;
  }

  pass() {
    const a = this.andrea, b = this.ball, j = this.joyWorld();
    if (!this.mates.length) return;
    const dir = j.m > 0.3 ? new THREE.Vector3(j.x, 0, j.z).normalize() : a.dir();
    let best = null, bs = -1e9;
    this.mates.forEach((m, i) => {
      const dx = m.pos.x - b.pos.x, dz = m.pos.z - b.pos.z, d = Math.hypot(dx, dz);
      let s = (dx * dir.x + dz * dir.z) / (d || 1) * 2 - d / 40;
      if (this.assisted && i === this.highlight) s += 1.2;
      if (s > bs) { bs = s; best = m; }
    });
    this.doKick(a, this.passVelocity(b.pos, best.pos), 0.5);
    this.passTo = best;
  }

  // ---------- logica dei singoli esercizi ----------
  step_tiri(dt) {
    const b = this.ball, gk = this.gk;
    this.keeperThink(gk, HL, -1, dt, { save: 0.28, reach: 1.8, speed: 0.85, rush: false });
    if (gk.holdT > 0) gk.holdT -= dt;
    if (this.shotState === 'flying') {
      this.shotT += dt;
      const r = this.keeperContact(gk, -1);
      if (r) { this.shotResult = 'parato'; if (r === 'catch') b.owner = gk; }
      if (b.owner === gk) b.pos.set(gk.pos.x - 0.4, 1, gk.pos.z);
      if (!this.shotResult && b.pos.x > HL + BALL_R && b.inNet && Math.abs(b.pos.z) < FIELD.GOAL_W) {
        this.shotResult = 'gol'; this.score++; this.hud.score(this.score, null);
        this.world.netHit(1, b.pos.z, b.pos.y, 1); Audio.sfx('net'); Audio.cheer(false); this.world.excite = 0.7;
        this.hud.comment(pick(['Gol!', 'Che tiro!', 'Bravissimo!'])); Audio.sfx('star');
      }
      if (!this.shotResult && (b.pos.x > HL + 1 || Math.abs(b.pos.z) > FIELD.HW)) this.shotResult = 'fuori';
      if (this.shotT > 3 && !this.shotResult) this.shotResult = 'fuori';
      if (this.shotResult && !this.shotDone) { this.shotDone = true; this.shotEndT = this.t; if (this.shotResult !== 'gol') this.hud.comment(this.shotResult === 'parato' ? 'Parato! Riprova!' : 'Fuori! Riprova!'); }
      if (this.shotDone && this.t - this.shotEndT > 1.4) {
        this.shotDone = false; this.attempt++;
        this.hud.hint(`Tiro ${Math.min(this.attempt + 1, this.maxAttempts)} di ${this.maxAttempts}`);
        if (this.attempt >= this.maxAttempts) this.finish(); else this.placeShot();
      }
    }
  }

  step_bersagli(dt) {
    const b = this.ball;
    if (this.shotState !== 'flying') return;
    this.shotT += dt;
    if (!this.crossed && b.pos.x > HL) {
      this.crossed = true;
      for (const t of this.targets) {
        if (t.hit) continue;
        if (Math.hypot(b.pos.z - t.z, b.pos.y - t.y) < 0.62) {
          t.hit = true; this.score++; this.hud.score(this.score, null);
          t.m.visible = false; t.disc.visible = false;
          this.firework(HL, t.y, t.z, t.m.material.color.getHex());
          Audio.sfx('star'); Audio.cheer(false); this.hud.comment(pick(['Centrato!', 'Bersaglio colpito!', 'Che mira!']));
          break;
        }
      }
      if (b.inNet) { this.world.netHit(1, b.pos.z, b.pos.y, 0.8); Audio.sfx('net'); }
    }
    if (this.shotT > 2.6) {
      this.attempt++;
      this.hud.hint(`Tiro ${Math.min(this.attempt + 1, this.maxAttempts)} di ${this.maxAttempts}`);
      if (this.attempt >= this.maxAttempts || this.targets.every(t => t.hit)) this.finish(); else this.placeTargetShot();
    }
  }

  step_passaggi(dt) {
    const b = this.ball;
    this.timer -= dt;
    this.hud.clock(Math.ceil(Math.max(0, this.timer)) + 's');
    const hm = this.mates[this.highlight];
    this.passRing.position.set(hm.pos.x, 0.05, hm.pos.z);
    this.passBeam.position.set(hm.pos.x, 3, hm.pos.z);
    for (const m of this.mates) {
      m.kickT = Math.max(0, m.kickT - dt);
      if (b.owner === m) {
        m.holdT += dt; this.face(m, this.andrea.pos.x, this.andrea.pos.z, dt);
        if (m.holdT > 0.6) { this.doKick(m, this.passVelocity(b.pos, this.andrea.pos), 0.4); m.cooldown = 0.6; }
        continue;
      }
      m.cooldown = Math.max(0, m.cooldown - dt);
      // va incontro alla palla se è diretta a lui
      const toward = this.passTo === m && !b.owner;
      const tx = toward ? b.pos.x : m.home.x, tz = toward ? b.pos.z : m.home.z;
      const lim = toward && Math.hypot(b.pos.x - m.home.x, b.pos.z - m.home.z) < 6;
      this.moveTowards(m, lim ? tx : m.home.x, lim ? tz : m.home.z, 5, dt);
      if (Math.hypot(m.vel.x, m.vel.z) < 0.4) this.face(m, b.pos.x, b.pos.z, dt);
      if (!b.owner && m.cooldown <= 0 && b.pos.y < 1 && Math.hypot(b.pos.x - m.pos.x, b.pos.z - m.pos.z) < 1.0) {
        b.owner = m; m.holdT = 0; b.vel.set(0, 0, 0);
        if (this.mates.indexOf(m) === this.highlight) {
          this.score++; this.hud.score(this.score, null); Audio.sfx('star');
          this.hud.comment(pick(['Bel passaggio!', 'Perfetto!', 'Bravissimo!']));
          let n; do { n = Math.floor(Math.random() * this.mates.length); } while (n === this.highlight);
          this.highlight = n;
        }
        this.passTo = null;
      }
    }
    // palla persa lontano: torna ad Andrea
    if (!b.owner && Math.hypot(b.vel.x, b.vel.z) < 0.2 && Math.hypot(b.pos.x - this.andrea.pos.x, b.pos.z - this.andrea.pos.z) > 12) {
      b.pos.set(this.andrea.pos.x + 0.6, BALL_R, this.andrea.pos.z);
    }
    if (this.timer <= 0) this.finish();
  }

  step_dribbling(dt) {
    const a = this.andrea, b = this.ball;
    this.timer += dt;
    this.hud.clock(this.timer.toFixed(1) + 's');
    const g = this.gates.find(x => !x.done);
    if (g) {
      this.gateMesh.position.set(g.x, 1.2, g.z);
      this.gateMesh.rotation.x += dt * 2;
      if (Math.abs(a.pos.x - g.x) < 0.8 && Math.abs(a.pos.z - g.z) < 1.6 && b.owner === a) {
        g.done = true; this.score++; Audio.sfx('star'); this.hud.score(this.score, null);
      }
    } else {
      this.gateMesh.position.set(this.finishX, 1.6, 0);
      if (a.pos.x > this.finishX && b.owner === a) this.finish();
    }
    if (b.owner !== a && !b.owner && Math.hypot(b.vel.x, b.vel.z) < 0.3 && Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z) > 8) b.pos.set(a.pos.x + 0.6, BALL_R, a.pos.z);
  }

  step_percorso(dt) {
    const a = this.andrea, b = this.ball;
    this.timer += dt;
    this.hud.clock(this.timer.toFixed(1) + 's');
    for (const s of this.stars) {
      if (!s.visible) continue;
      s.rotation.y += dt * 3; s.position.y = 1 + Math.sin(this.t * 3 + s.position.x) * 0.2;
      if (Math.hypot(a.pos.x - s.position.x, a.pos.z - s.position.z) < 1.2 && b.owner === a) {
        s.visible = false; this.score++; this.hud.score(this.score, null);
        Audio.sfx('star'); this.firework(s.position.x, 2, s.position.z, 0xffe14d);
      }
    }
    if (this.stars.every(s => !s.visible)) this.finish();
    if (!b.owner && Math.hypot(b.vel.x, b.vel.z) < 0.3 && Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z) > 8) b.pos.set(a.pos.x + 0.6, BALL_R, a.pos.z);
  }

  finish() {
    if (this.phase === 'end') return;
    this.phase = 'end'; this.phaseT = 0;
    Audio.sfx('whistle3');
    const res = this.result();
    const medal = medalFor(this.drill, res);
    this.medal = medal;
    const names = { oro: "MEDAGLIA D'ORO!", argento: "MEDAGLIA D'ARGENTO!", bronzo: 'MEDAGLIA DI BRONZO!' };
    this.hud.banner(medal ? names[medal] : 'Bravo! Continua ad allenarti!', 3000, medal ? 'win' : '');
    Audio.say(medal === 'oro' ? "Fantastico Andrea! Medaglia d'oro!" : medal ? 'Bravissimo Andrea! Hai vinto una medaglia!' : 'Bravo Andrea! Allenandoti diventerai un campione!');
    this.andrea.celebrateT = 3; this.andrea.celebrateType = this.opts.celebration || 'salto';
    if (medal) { Audio.cheer(true); this.confetti(this.andrea.pos.x, this.andrea.pos.z, ['#ffe14d', '#ff4f6d', '#4fb3ff']); }
  }
  result() {
    if (this.drill === 'dribbling' || this.drill === 'percorso') return Math.round(this.timer * 10) / 10;
    return this.score;
  }
  summary() { return { mode: 'training', drill: this.drill, score: this.result(), medal: this.medal }; }

  visual(dt) {
    for (const p of this.players) p.animate(dt);
    this.ball.sync(dt);
    this.placeIndicator(this.phase === 'end' ? null : this.andrea, this.t);
    this.hud.power(this.ball.owner === this.andrea ? this.charge() : 0);
    this.hud.labels(true);
    const a = this.andrea;
    if (this.drill === 'tiri' || this.drill === 'bersagli') {
      const look = new THREE.Vector3((a.pos.x + HL) / 2 + 2, 1, a.pos.z * 0.4);
      this.setCam(new THREE.Vector3(a.pos.x - 8, 5, a.pos.z * 0.6 + 6), look, dt, 2.5);
    } else if (this.phase === 'end') {
      this.setCam(new THREE.Vector3(a.pos.x + 5, 2.8, a.pos.z + 5), new THREE.Vector3(a.pos.x, 1.2, a.pos.z), dt, 2);
    } else {
      this.setCam(new THREE.Vector3(a.pos.x - 2, 13, a.pos.z + 16), new THREE.Vector3(a.pos.x + 3, 0, a.pos.z), dt, 3);
    }
  }
}
