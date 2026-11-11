// PARTITA 3D: 6 contro 6, squadra di Andrea (team 0) attacca verso +x.
import { BaseGame, THREE, FIELD, BALL_R, input, clamp, rand, pick } from './core.js';
import * as Audio from '../audio.js';

const HL = FIELD.HL, HW = FIELD.HW;
// formazione (coordinate "proprie": si attacca verso +x)
const FORM = [[-HL + 1.2, 0], [-20, -7.5], [-20, 7.5], [-8, -10], [-8, 10], [-2, 0]];
const ROLE_PUSH = { POR: 0, DIF: 3, CEN: 7, ATT: 10 };

const GOAL_LINES = ['GOOOOOOL DI ANDREA!', 'GOOOOL! CHE CAMPIONE ANDREA!', 'GOOOOL! RETE FANTASTICA DI ANDREA!', 'GOOOL! ANDREA HA SEGNATO!'];
const SHOT_LINES = ['Che tiro incredibile!', 'Tiro potentissimo!', 'Bellissimo tiro!'];
const CONCEDE_LINES = ['Gol degli avversari. Non mollare Andrea, puoi farcela!', 'Hanno segnato loro... Forza Andrea, adesso tocca a te!', 'Peccato! Ma la partita non è finita!'];

export class MatchGame extends BaseGame {
  constructor(renderer, opts, hud) {
    super(renderer, opts, hud);
    this.teams = [[], []];
    for (let t = 0; t < 2; t++) {
      opts.rosters[t].forEach((info, i) => {
        const p = this.addPlayer(info, opts.kits[t], t, i === 0);
        p.role = info.role; p.idx = i; p.jit = { x: 0, z: 0, t: 0 };
        this.teams[t].push(p);
      });
    }
    this.andrea = this.teams[0][5];
    this.controlled = this.andrea;
    this.score = [0, 0];
    this.clock = 0; this.total = Math.max(60, (opts.duration || 3) * 60); this.half = 1;
    this.phase = 'intro'; this.phaseT = 0;
    this.replayBuf = []; this.replay = null;
    this.aiT = 0; this.switchT = 0; this.lastComment = -10; this.t = 0;
    this.stats = { shots: [0, 0], andreaGoals: 0, saves: [0, 0] };
    this.kickoffTeam = 0;
    this.setKickoff(0);
    this.snapCam(new THREE.Vector3(-30, 22, 40), new THREE.Vector3(0, 0, 0));
    Audio.crowdStart();
    hud.score(0, 0); hud.clock("0'");
    hud.banner(`${opts.home.name}  contro  ${opts.away.name}`, 2600, 'intro');
    this.world.updateScoreboard(0, 0, "0'", opts.stadium.name.toUpperCase());
  }

  dirOf(t) { return t === 0 ? 1 : -1; }

  comment(text, prio = false, speak = true) {
    if (!prio && this.t - this.lastComment < 2.5) return;
    this.lastComment = this.t;
    this.hud.comment(text);
    if (speak) Audio.say(text);
  }

  // ---------------- schieramenti ----------------
  setKickoff(team) {
    this.kickoffTeam = team;
    const b = this.ball;
    b.owner = null; b.vel.set(0, 0, 0); b.pos.set(0, BALL_R, 0); b.inNet = 0; b.lastKickTeam = -1; b.passTarget = null;
    for (let t = 0; t < 2; t++) {
      const d = this.dirOf(t);
      this.teams[t].forEach((p, i) => {
        let [x, z] = FORM[i];
        x = Math.min(x, -1.5);
        if (i === 5) { x = t === team ? -0.55 : -9.5; z = 0; }
        if (i === 4 && t === team) { x = -3; z = 3; }
        p.pos.set(x * d, 0, z); p.vel.set(0, 0, 0);
        p.facing = d > 0 ? Math.PI / 2 : -Math.PI / 2;
        p.kickT = p.tackleT = p.diveT = p.celebrateT = p.stunT = p.cooldown = p.holdT = 0;
        p.frozen = false; p.plan = null; p.saveIntent = false; p.ignoreT = 0;
      });
    }
    const kicker = this.teams[team][5];
    b.owner = kicker; b.lastTouch = kicker; b.lastKickTeam = team;
    this.dribble(kicker, 1);
    this.controlled = team === 0 ? kicker : this.andrea;
  }

  setPiece(team, x, z, kind) {
    const b = this.ball;
    b.vel.set(0, 0, 0); b.inNet = 0; b.passTarget = null;
    const d = this.dirOf(team);
    if (kind === 'goalkick') {
      const gk = this.teams[team][0];
      gk.pos.set(-d * (HL - 3), 0, 0); gk.vel.set(0, 0, 0);
      b.owner = gk; b.lastTouch = gk; b.lastKickTeam = team; gk.holdT = 1.6; gk.plan = null;
      b.pos.set(gk.pos.x + d * 0.4, 1, 0);
      this.hud.banner('Rimessa dal fondo', 1300);
      if (team === 0 && this.controlled.isKeeper) this.controlled = this.andrea;
      return;
    }
    b.pos.set(x, BALL_R, z);
    const cands = this.teams[team].filter(p => !p.isKeeper);
    let taker = cands.reduce((a, p) => (p.pos.distanceTo(b.pos) < a.pos.distanceTo(b.pos) ? p : a), cands[0]);
    // il tiratore si mette dietro la palla guardando il campo
    const toC = new THREE.Vector3(kind === 'corner' ? d * (HL - 9) - x : -x * 0.3, 0, -z).normalize();
    taker.pos.set(x - toC.x * 0.65, 0, z - toC.z * 0.65); taker.vel.set(0, 0, 0);
    taker.facing = Math.atan2(toC.x, toC.z);
    b.owner = taker; b.lastTouch = taker; b.lastKickTeam = team;
    taker.frozen = true; taker.frozenT = 0;
    for (const q of this.teams[1 - team]) {
      const dx = q.pos.x - x, dz = q.pos.z - z, dd = Math.hypot(dx, dz);
      if (dd < 4 && !q.isKeeper) { q.pos.x = x + dx / (dd || 1) * 4.2; q.pos.z = z + dz / (dd || 1) * 4.2; }
    }
    if (team === 0) this.controlled = taker;
    this.hud.banner(kind === 'corner' ? "Calcio d'angolo!" : 'Rimessa laterale', 1300);
    if (kind === 'corner') this.comment("Calcio d'angolo!", false, team === 0);
  }

  // ---------------- ciclo fisso ----------------
  fixed(dt) {
    this.t += dt; this.phaseT += dt;
    const ph = this.phase;
    if (ph === 'intro') {
      for (const p of this.players) { p.vel.set(0, 0, 0); }
      if (this.phaseT > 2.8) { this.phase = 'kickoff'; this.phaseT = 0; }
    } else if (ph === 'kickoff') {
      if (this.phaseT > 0.9) {
        Audio.sfx('whistle'); this.phase = 'play'; this.phaseT = 0;
        if (this.half === 1 && this.clock === 0) this.comment('Si comincia! Forza Andrea!', true);
        if (this.kickoffTeam === 1) this.aiPass(this.teams[1][5], true);
      }
    } else if (ph === 'play') {
      this.playStep(dt);
      this.clock += dt;
      if (this.half === 1 && this.clock >= this.total / 2) this.toHalf();
      else if (this.clock >= this.total) this.toEnd();
    } else if (ph === 'goal') {
      this.goalStep(dt);
    } else if (ph === 'replay') {
      this.replayStep(dt);
    } else if (ph === 'half') {
      this.idleStep(dt);
      if (this.phaseT > 3.2) { this.setKickoff(1); this.phase = 'kickoff'; this.phaseT = 0; }
    } else if (ph === 'end') {
      this.endStep(dt);
    }
    if (ph !== 'replay') this.recordFrame();
  }

  toHalf() {
    this.half = 2; this.phase = 'half'; this.phaseT = 0;
    Audio.sfx('whistle2');
    this.hud.banner('Fine primo tempo!', 2600);
    this.comment('Fine del primo tempo! Bravo Andrea, si riparte tra poco!', true);
    this.ball.owner = null;
  }
  toEnd() {
    this.phase = 'end'; this.phaseT = 0; this.ended = false;
    Audio.sfx('whistle3');
    const [h, a] = this.score;
    this.ball.owner = null;
    if (h > a) {
      this.hud.banner('VITTORIA!', 4000, 'win');
      this.comment('Fischio finale! Vittoria! Andrea sei un campione!', true);
      this.teams[0].forEach((p, i) => { p.celebrateT = 6; p.celebrateType = ['salto', 'aeroplano', 'ballo'][i % 3]; });
      Audio.cheer(true); this.world.excite = 1;
      this.confetti(this.andrea.pos.x, this.andrea.pos.z, [this.opts.kits[0].c1, this.opts.kits[0].c2, '#ffe14d']);
    } else if (h === a) {
      this.hud.banner('PAREGGIO!', 4000);
      this.comment('Fischio finale! Pareggio! Che bella partita, Andrea!', true);
      Audio.cheer(false);
    } else {
      this.hud.banner('BRAVO LO STESSO!', 4000);
      this.comment("Fischio finale. Bravo lo stesso! Andiamo campione, un'altra partita!", true);
      this.teams[1].forEach(p => { p.celebrateT = 4; p.celebrateType = 'salto'; });
    }
  }

  idleStep(dt) {
    for (const p of this.players) {
      p.vel.multiplyScalar(0.9);
      p.pos.addScaledVector(p.vel, dt);
      p.celebrateT = Math.max(0, p.celebrateT - dt);
    }
    if (!this.ball.owner) this.ball.step(dt);
    this.ball.events.length = 0;
  }

  endStep(dt) {
    this.idleStep(dt);
    if (this.score[0] > this.score[1] && Math.floor(this.phaseT * 2.5) !== Math.floor((this.phaseT - dt) * 2.5)) {
      this.firework(rand(-25, 25), rand(14, 22), rand(-30, -22), pick([0xffe14d, 0xff4f6d, 0x4fb3ff, 0x5dff8a]));
    }
    if (this.phaseT > 4.8 && !this.ended) {
      this.ended = true;
      this.hud.end({ gf: this.score[0], ga: this.score[1], andreaGoals: this.stats.andreaGoals, shots: this.stats.shots[0] });
    }
  }

  // ---------------- gioco ----------------
  playStep(dt) {
    const b = this.ball;
    for (const p of this.players) {
      p.cooldown = Math.max(0, p.cooldown - dt); p.kickT = Math.max(0, p.kickT - dt);
      p.tackleT = Math.max(0, p.tackleT - dt); p.stunT = Math.max(0, p.stunT - dt);
      p.celebrateT = 0;
    }
    this.aiT -= dt;
    if (this.aiT <= 0) { this.aiT = 0.1; this.aiThink(); }
    this.userControl(dt);
    // movimento dei giocatori controllati dal computer
    for (const p of this.players) {
      if (p === this.controlled) continue;
      if (p.isKeeper) { this.keeperStep(p, dt); continue; }
      if (p.frozen) { p.vel.set(0, 0, 0); this.frozenStep(p, dt); continue; }
      const sp = this.aiSpeed(p) * (p.stunT > 0 ? 0.35 : 1) * (p.sprinting ? 1.2 : 1);
      this.moveTowards(p, p.target.x, p.target.z, sp, dt);
      if (Math.hypot(p.vel.x, p.vel.z) < 0.5 && b.owner !== p) this.face(p, b.pos.x, b.pos.z, dt);
    }
    // palla
    if (b.owner) {
      const o = b.owner;
      if (o.isKeeper) { b.pos.set(o.pos.x + Math.sin(o.facing) * 0.35, 1.0, o.pos.z + Math.cos(o.facing) * 0.35); b.vel.set(0, 0, 0); }
      else this.dribble(o, dt);
    } else {
      b.step(dt);
    }
    for (const [ev, v] of b.events) {
      if (ev === 'bounce') Audio.sfx('bounce', v);
      if (ev === 'post') { Audio.sfx('post'); Audio.ooh(); this.comment('Palo! Che sfortuna!', true); }
    }
    b.events.length = 0;
    this.pickups();
    this.separate();
    this.checkBounds();
  }

  aiSpeed(p) {
    const base = 6.3 * (0.75 + p.info.speed * 0.3);
    return p.team === 1 ? base * this.diff.aiSpeed * (this.assisted ? 0.92 : 1) : base * 0.95;
  }

  userControl(dt) {
    const p = this.controlled, b = this.ball;
    const j = this.joyWorld();
    const hasBall = b.owner === p;
    if (p.frozen) {
      p.frozenT += dt;
      p.vel.set(0, 0, 0);
      if (j.m > 0.3) p.facing = Math.atan2(j.x, j.z);
      if (input.pass || input.shoot || p.frozenT > 6) { p.frozen = false; this.userPass(p); }
      this.dribble(p, 1);
      return;
    }
    let speed = 6.7 * (0.8 + p.info.speed * 0.25);
    if (input.sprint || j.far) speed *= 1.32;
    if (hasBall) speed *= 0.88;
    if (p.stunT > 0) speed *= 0.4;
    let vx = j.x * speed, vz = j.z * speed;
    // aiuto: se la palla arriva verso di me e non tocco il joystick, vado incontro alla palla
    if (j.m < 0.2 && !b.owner && (b.passTarget === p || this.assisted)) {
      const fut = b.pos.clone().addScaledVector(b.vel, 0.35);
      const d = Math.hypot(fut.x - p.pos.x, fut.z - p.pos.z);
      if (d < (b.passTarget === p ? 30 : 5) && d > 0.3) { vx = (fut.x - p.pos.x) / d * speed * 0.8; vz = (fut.z - p.pos.z) / d * speed * 0.8; }
    }
    this.steer(p, vx, vz, dt, hasBall ? 16 : 26);
    // pulsanti
    const near = !b.owner && Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z) < 1.6 && b.pos.y < 1.2;
    if (input.pass) {
      if (hasBall || near) this.userPass(p);
      else this.switchPlayer(true);
    }
    if (input.shoot) {
      if (hasBall || near) this.userShoot(p, input.shootPower);
      else this.userTackle(p);
    }
    if (input.switch) this.switchPlayer(true);
    // cambio automatico del giocatore più vicino alla palla
    this.switchT -= dt;
    if (this.switchT <= 0 && b.owner?.team !== 0) {
      this.switchT = 0.35;
      this.switchPlayer(false);
    }
    // assistito: ruba palla automaticamente se attaccato all'avversario
    if (this.assisted && b.owner && b.owner.team === 1 && !b.owner.frozen && !b.owner.isKeeper) {
      const d = Math.hypot(b.owner.pos.x - p.pos.x, b.owner.pos.z - p.pos.z);
      if (d < 1.0 && Math.random() < dt * 0.6) this.steal(p, b.owner);
    }
  }

  switchPlayer(manual) {
    const b = this.ball;
    const fut = b.pos.clone().addScaledVector(b.vel, 0.4);
    let best = null, bd = 1e9;
    for (const p of this.teams[0]) {
      if (p.isKeeper || (manual && p === this.controlled)) continue;
      const d = Math.hypot(p.pos.x - fut.x, p.pos.z - fut.z);
      if (d < bd) { bd = d; best = p; }
    }
    if (!best || best === this.controlled) return;
    const cur = Math.hypot(this.controlled.pos.x - fut.x, this.controlled.pos.z - fut.z);
    if (manual || bd + (this.assisted ? 2.5 : 4) < cur) {
      // non togliere il controllo mentre si aspetta un passaggio
      if (!manual && b.passTarget === this.controlled && !b.owner) return;
      this.controlled = best;
      if (manual) Audio.sfx('click');
    }
  }

  userPass(p) {
    const b = this.ball, j = this.joyWorld();
    const dir = j.m > 0.3 ? new THREE.Vector3(j.x, 0, j.z).normalize() : p.dir();
    let best = null, bs = -1e9;
    for (const q of this.teams[0]) {
      if (q === p) continue;
      const lead = q.pos.clone().addScaledVector(q.vel, 0.35);
      const dx = lead.x - b.pos.x, dz = lead.z - b.pos.z, d = Math.hypot(dx, dz);
      if (d < 2.5) continue;
      const cos = (dx * dir.x + dz * dir.z) / d;
      const open = Math.min(6, this.nearestDist(q, 1));
      let s = cos * 2.4 - d / 30 + open / 7;
      if (this.assisted) s += dx / 45;
      if (q.isKeeper) s -= 2.5;
      if (s > bs) { bs = s; best = q; }
    }
    if (!best) return;
    const lead = best.pos.clone().addScaledVector(best.vel, 0.35);
    const blocked = this.laneBlocked(b.pos, lead, 1);
    const lofted = blocked && b.pos.distanceTo(lead) > 9;
    const v = this.passVelocity(b.pos, lead, lofted);
    if (!this.assisted) { const e = (1 - p.info.pass) * 2.5; v.x += rand(-e, e); v.z += rand(-e, e); }
    if (p.frozen) p.frozen = false;
    this.doKick(p, v, 0.45);
    b.passTarget = best;
    this.controlled = best;
  }

  userShoot(p, power) {
    const b = this.ball, j = this.joyWorld();
    power = Math.max(0.3, power);
    const gk = this.teams[1][0];
    let aimZ;
    if (Math.abs(j.z) > 0.35) aimZ = Math.sign(j.z) * FIELD.GOAL_W * 0.72;
    else aimZ = (gk.pos.z > 0.15 ? -1 : gk.pos.z < -0.15 ? 1 : (Math.random() < 0.5 ? -1 : 1)) * FIELD.GOAL_W * 0.62;
    let h = 0.35 + power * 1.25;
    let err = this.assisted ? 0.25 : (1.15 - p.info.shot) * 2.4;
    const dist = Math.hypot(HL - b.pos.x, b.pos.z);
    err *= clamp(dist / 18, 0.5, 2);
    if (this.assisted) h = Math.min(h, 1.85);
    else if (power > 0.95) h = FIELD.GOAL_H + 0.7;
    const speed = 14 + power * 14;
    const v = this.shotVelocity(b.pos, HL + 0.6, h + rand(-0.2, 0.2), aimZ + rand(-err, err), speed);
    this.doKick(p, v, 0.6 + power * 0.4);
    this.stats.shots[0]++;
    this.lastShooter = p;
    if (power > 0.7 && dist > 12) this.comment(pick(SHOT_LINES), false);
    Audio.crowdSet(0.6, 0.3);
  }

  userTackle(p) {
    if (p.tackleT > 0) return;
    p.tackleT = 0.45;
    const d = p.dir();
    p.vel.x += d.x * 3; p.vel.z += d.z * 3;
    const o = this.ball.owner;
    if (o && o.team === 1 && !o.frozen) {
      const dx = o.pos.x - p.pos.x, dz = o.pos.z - p.pos.z, dist = Math.hypot(dx, dz);
      if (dist < 2.1 && (dx * d.x + dz * d.z) / (dist || 1) > -0.2) {
        if (Math.random() < (this.assisted ? 0.88 : 0.66) && !o.isKeeper) { this.steal(p, o); return; }
      }
    }
  }

  steal(by, from) {
    from.stunT = 0.7; from.vel.multiplyScalar(0.2); from.cooldown = 0.8;
    this.gain(by);
    if (by.team === 0) { this.comment(pick(['Palla recuperata!', 'Bravo, palla rubata!', 'Che contrasto!']), false); Audio.crowdSet(0.5, 0.3); }
  }

  gain(p) {
    const b = this.ball;
    b.owner = p; b.lastTouch = p; b.lastKickTeam = p.team; b.passTarget = null;
    p.holdT = 0; p.aiHold = 0;
    if (p.team === 0 && !p.isKeeper) this.controlled = p;
  }

  nearestDist(p, team) {
    let m = 1e9;
    for (const q of this.teams[team]) { const d = Math.hypot(q.pos.x - p.pos.x, q.pos.z - p.pos.z); if (d < m) m = d; }
    return m;
  }
  laneBlocked(a, c, team) {
    const dx = c.x - a.x, dz = c.z - a.z, L = Math.hypot(dx, dz) || 1;
    for (const q of this.teams[team]) {
      const t = ((q.pos.x - a.x) * dx + (q.pos.z - a.z) * dz) / (L * L);
      if (t < 0.1 || t > 0.95) continue;
      const px = a.x + dx * t, pz = a.z + dz * t;
      if (Math.hypot(q.pos.x - px, q.pos.z - pz) < 1.3) return true;
    }
    return false;
  }

  pickups() {
    const b = this.ball;
    if (b.owner) return;
    // portieri
    for (let t = 0; t < 2; t++) {
      const gk = this.teams[t][0];
      const out = this.dirOf(t);
      const wasShot = b.lastKickTeam === 1 - t;
      const r = this.keeperContact(gk, out);
      if (r) {
        this.stats.saves[t]++;
        if (r === 'catch') { b.owner = gk; b.passTarget = null; }
        if (wasShot) {
          if (t === 1) { this.comment(pick(['Grandissima parata!', 'Che parata del portiere!', 'Parato! Riprova Andrea!']), true); Audio.ooh(); }
          else { this.comment(pick(['Che parata! Il nostro portiere è un muro!', 'Grandissima parata!']), true); Audio.cheer(false); }
        }
        return;
      }
    }
    if (b.pos.y > 1.0) return;
    const sp = Math.hypot(b.vel.x, b.vel.z);
    let best = null, bd = 0.72;
    for (const p of this.players) {
      if (p.cooldown > 0 || p.stunT > 0 || p.diveT > 0) continue;
      if (p.isKeeper && p.ignoreT > 0) continue;
      const d = Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z);
      const reach = p.isKeeper ? 0.95 : (p === this.controlled && this.assisted ? 0.9 : 0.72);
      if (d < reach && d < bd + (reach - 0.72)) { bd = d; best = p; }
    }
    if (!best) return;
    if (sp > 21 && !best.isKeeper && Math.random() < 0.5) {
      b.vel.multiplyScalar(-0.25); b.vel.z += rand(-3, 3); best.cooldown = 0.3; Audio.sfx('kick', 0.3);
      return;
    }
    if (best.isKeeper) best.holdT = 1.3;
    this.gain(best);
  }

  checkBounds() {
    const b = this.ball;
    if (b.owner) return;
    const p = b.pos;
    // gol
    if (Math.abs(p.x) > HL + BALL_R && Math.abs(p.z) < FIELD.GOAL_W && p.y < FIELD.GOAL_H && b.inNet) {
      this.goal(p.x > 0 ? 0 : 1);
      return;
    }
    if (Math.abs(p.z) > HW + BALL_R) {
      const last = b.lastKickTeam < 0 ? 0 : b.lastKickTeam;
      this.setPiece(1 - last, clamp(p.x, -HL + 1, HL - 1), Math.sign(p.z) * (HW - 0.3), 'throw');
      return;
    }
    if (Math.abs(p.x) > HL + BALL_R && !b.inNet) {
      const s = Math.sign(p.x);
      const defending = s > 0 ? 1 : 0;
      const nearMiss = Math.abs(p.z) < FIELD.GOAL_W + 2.5;
      if (nearMiss && b.lastKickTeam === 0) { this.comment('Uhhh! Di pochissimo fuori!', true); Audio.ooh(); }
      if (b.lastKickTeam === defending) this.setPiece(1 - defending, s * (HL - 0.4), Math.sign(p.z || 1) * (HW - 0.4), 'corner');
      else this.setPiece(defending, 0, 0, 'goalkick');
    }
  }

  // ---------------- intelligenza artificiale ----------------
  aiThink() {
    const b = this.ball;
    const owner = b.owner;
    const possTeam = owner ? owner.team : -1;
    const fut = b.pos.clone().addScaledVector(b.vel, 0.45);
    for (let t = 0; t < 2; t++) {
      const d = this.dirOf(t);
      const ballOwn = { x: b.pos.x * d, z: b.pos.z };
      const field = this.teams[t].filter(p => !p.isKeeper);
      // chi va sulla palla
      let chaser = null;
      if (possTeam !== t && !(owner && owner.isKeeper)) {
        let bd = 1e9;
        for (const p of field) {
          if (t === 0 && p === this.controlled) continue;
          const dd = Math.hypot(p.pos.x - fut.x, p.pos.z - fut.z);
          if (dd < bd) { bd = dd; chaser = p; }
        }
        if (t === 0) {
          // un compagno aiuta solo se la palla è nella nostra metà o libera e lontana dal giocatore di Andrea
          const cd = Math.hypot(this.controlled.pos.x - fut.x, this.controlled.pos.z - fut.z);
          if (!(ballOwn.x < 0 || (!owner && bd < cd - 3))) chaser = null;
        }
      }
      // copertura: il secondo più vicino si mette tra il portatore e la porta
      let cover = null;
      if (owner && owner.team !== t && !owner.isKeeper) {
        let bd = 1e9;
        for (const p of field) {
          if (p === chaser || (t === 0 && p === this.controlled)) continue;
          const dd = Math.hypot(p.pos.x - owner.pos.x, p.pos.z - owner.pos.z);
          if (dd < bd) { bd = dd; cover = p; }
        }
      }
      for (const p of field) {
        if (t === 0 && p === this.controlled) continue;
        p.sprinting = false;
        if (p === cover) {
          const gx = -d * HL, vx = gx - owner.pos.x, vz = -owner.pos.z, l = Math.hypot(vx, vz) || 1;
          const k = Math.min(5, l * 0.5);
          p.target.set(owner.pos.x + vx / l * k + owner.vel.x * 0.3, 0, owner.pos.z + vz / l * k + owner.vel.z * 0.3);
          p.sprinting = true;
          if (Math.hypot(owner.pos.x - p.pos.x, owner.pos.z - p.pos.z) < 1.15 && !owner.frozen && Math.random() < (t === 1 ? this.diff.tackle * (this.assisted ? 0.6 : 1) * 0.3 : this.diff.mateTackle * 0.6)) { p.tackleT = 0.4; this.steal(p, owner); }
          continue;
        }
        p.jit.t -= 0.1;
        if (p.jit.t <= 0) { p.jit.t = rand(1.5, 3); p.jit.x = rand(-2.5, 2.5); p.jit.z = rand(-3, 3); }
        const base = FORM[p.idx];
        if (owner === p) { this.aiOwner(p); continue; }
        if (p === chaser) {
          // intercetta: punta davanti al portatore, non dietro
          if (owner) p.target.set(owner.pos.x + owner.vel.x * 0.45, 0, owner.pos.z + owner.vel.z * 0.45);
          else p.target.set(fut.x, 0, fut.z);
          p.sprinting = true;
          // contrasto automatico
          if (owner && owner.team !== t && !owner.frozen && !owner.isKeeper) {
            const dd = Math.hypot(owner.pos.x - p.pos.x, owner.pos.z - p.pos.z);
            let prob = t === 1 ? this.diff.tackle * (this.assisted ? 0.6 : 1) * 0.45 : this.diff.mateTackle;
            if (owner === this.controlled && owner.stunT > 0) prob = 0;
            if (dd < 1.15 && Math.random() < prob) { p.tackleT = 0.4; this.steal(p, owner); }
          }
          continue;
        }
        let x, z;
        if (possTeam === t) {
          // attacco: si alza e si smarca
          x = base[0] * 0.5 + ballOwn.x * 0.55 + ROLE_PUSH[p.role] + p.jit.x;
          z = base[1] * 1.15 + ballOwn.z * 0.2 + p.jit.z;
          x = clamp(x, -HL + 6, HL - (p.role === 'ATT' ? 5 : 8));
          // allontanati dall'avversario più vicino (smarcamento)
          const opp = this.closestOf(1 - t, x * d, z);
          if (opp && opp.d < 3.5) { z += Math.sign(z - opp.p.pos.z || 1) * (3.5 - opp.d); }
        } else {
          // difesa: compatti verso la palla, i difensori marcano
          x = base[0] * 0.75 + ballOwn.x * 0.45 - 3;
          z = base[1] * 0.8 + ballOwn.z * 0.35;
          x = clamp(x, -HL + 3, HL - 12);
          if (p.role === 'DIF') {
            let mk = null, md = 11;
            for (const q of this.teams[1 - t]) {
              if (q.isKeeper) continue;
              const qx = q.pos.x * d;
              const dd = Math.hypot(qx - x, q.pos.z - z);
              if (qx < 2 && dd < md) { md = dd; mk = q; }
            }
            if (mk) {
              const gx = -d * HL;
              const vx = gx - mk.pos.x, vz = -mk.pos.z, l = Math.hypot(vx, vz) || 1;
              p.target.set(mk.pos.x + vx / l * 1.8, 0, mk.pos.z + vz / l * 1.8);
              continue;
            }
          }
        }
        p.target.set(x * d, 0, clamp(z, -HW + 1, HW - 1));
      }
    }
  }

  closestOf(team, x, z) {
    let best = null, bd = 1e9;
    for (const q of this.teams[team]) { const d = Math.hypot(q.pos.x - x, q.pos.z - z); if (d < bd) { bd = d; best = q; } }
    return best ? { p: best, d: bd } : null;
  }

  aiOwner(p) {
    // possessore controllato dal computer (squadra avversaria)
    const d = this.dirOf(p.team);
    p.aiHold = (p.aiHold || 0) + 0.1;
    const gx = d * HL;
    const dist = Math.hypot(gx - p.pos.x, p.pos.z);
    const opp = this.closestOf(1 - p.team, p.pos.x, p.pos.z);
    const pressure = opp ? opp.d : 99;
    const range = 11 + p.info.shot * 9;
    if (p.aiHold > 0.4 && dist < range && (Math.random() < 0.3 || dist < 9)) { this.aiShoot(p); return; }
    if (p.aiHold > 0.3 && ((pressure < 2.3 && Math.random() < 0.4) || Math.random() < 0.025)) { if (this.aiPass(p)) return; }
    // dribbling verso la porta evitando l'avversario
    let tz = p.pos.z * 0.85;
    if (opp && opp.d < 5) {
      const front = (opp.p.pos.x - p.pos.x) * d > 0;
      if (front) tz = p.pos.z + Math.sign(p.pos.z - opp.p.pos.z || rand(-1, 1)) * 4;
    }
    p.target.set(p.pos.x + d * 6, 0, clamp(tz, -HW + 2, HW - 2));
    p.sprinting = false;
  }

  aiPass(p, kickoff = false) {
    const b = this.ball, d = this.dirOf(p.team);
    let best = null, bs = -1e9;
    for (const q of this.teams[p.team]) {
      if (q === p || q.isKeeper) continue;
      const dist = Math.hypot(q.pos.x - p.pos.x, q.pos.z - p.pos.z);
      if (dist < 3 || dist > 30) continue;
      const fwd = (q.pos.x - p.pos.x) * d;
      const open = Math.min(6, this.nearestDist(q, 1 - p.team));
      let s = fwd / 10 + open / 3 - dist / 25 + rand(0, 0.8);
      if (kickoff) s = -Math.abs(dist - 6);
      if (this.laneBlocked(b.pos, q.pos, 1 - p.team)) s -= 1.5;
      if (s > bs) { bs = s; best = q; }
    }
    if (!best) return false;
    const lead = best.pos.clone().addScaledVector(best.vel, 0.35);
    const v = this.passVelocity(b.pos, lead, !kickoff && this.laneBlocked(b.pos, lead, 1 - p.team));
    const e = (1 - p.info.pass) * 2;
    v.x += rand(-e, e); v.z += rand(-e, e);
    p.frozen = false;
    this.doKick(p, v, 0.45);
    b.passTarget = best;
    return true;
  }

  aiShoot(p) {
    const b = this.ball, d = this.dirOf(p.team);
    const gx = d * (HL + 0.6);
    const err = this.diff.aiShotErr * (1.2 - p.info.shot) * 2.2 * (this.assisted ? 1.3 : 1);
    const z = (Math.random() < 0.5 ? -1 : 1) * FIELD.GOAL_W * rand(0.2, 0.85) + rand(-err, err);
    const h = rand(0.3, 1.9) + rand(-err, err) * 0.3;
    const speed = 13 + p.info.shot * 9 + (this.opts.difficulty === 'difficile' ? 3 : 0);
    this.doKick(p, this.shotVelocity(b.pos, gx, h, z, speed), 0.8);
    this.stats.shots[p.team]++;
    if (p.team === 1) Audio.crowdSet(0.55, 0.3);
  }

  frozenStep(p, dt) {
    // rimesse per la squadra del computer
    p.frozenT += dt;
    this.dribble(p, 1);
    if (p.frozenT > 1.3) { if (!this.aiPass(p)) { p.frozen = false; } }
  }

  keeperStep(gk, dt) {
    const out = this.dirOf(gk.team);
    const goalX = -out * HL;
    const b = this.ball;
    if (b.owner === gk) {
      gk.holdT -= dt;
      gk.vel.multiplyScalar(0.8);
      gk.facing = out > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (gk.holdT <= 0) {
        // rinvio verso un compagno
        let best = null, bs = -1e9;
        for (const q of this.teams[gk.team]) {
          if (q === gk) continue;
          const open = Math.min(8, this.nearestDist(q, 1 - gk.team));
          const s = open - Math.abs((q.pos.x - gk.pos.x) * out - 18) / 8 + rand(0, 1);
          if (s > bs) { bs = s; best = q; }
        }
        const lead = best.pos.clone();
        const far = gk.pos.distanceTo(lead) > 14;
        this.doKick(gk, this.passVelocity(new THREE.Vector3(b.pos.x, BALL_R, b.pos.z), lead, far), 0.7);
        b.passTarget = best;
        if (gk.team === 0) this.controlled = best;
      }
      return;
    }
    const isUserGK = gk.team === 0;
    const params = isUserGK
      ? { save: 0.62 + (this.assisted ? 0.15 : 0) + (this.opts.difficulty === 'facile' ? 0.1 : 0), reach: 2.3, speed: 1, rush: true }
      : { save: this.diff.gkSave * (this.assisted ? 0.9 : 1), reach: this.diff.gkReach, speed: this.diff.aiSpeed + 0.1, rush: true };
    this.keeperThink(gk, goalX, out, dt, params);
  }

  // ---------------- gol, esultanza, replay ----------------
  goal(team) {
    const b = this.ball;
    this.score[team]++;
    this.hud.score(this.score[0], this.score[1]);
    const side = team === 0 ? 1 : -1;
    this.world.netHit(side, b.pos.z, b.pos.y, Math.hypot(b.vel.x, b.vel.z) / 18);
    Audio.sfx('net');
    let scorer = b.lastTouch && b.lastTouch.team === team ? b.lastTouch : this.teams[team][5];
    if (scorer.isKeeper) scorer = this.teams[team][5];
    this.scorer = scorer;
    this.phase = 'goal'; this.phaseT = 0; this.replaySaved = false;
    this.goalTeam = team;
    if (team === 0) {
      this.stats.andreaGoals++;
      Audio.cheer(true); this.world.excite = 1;
      this.comment(pick(GOAL_LINES), true);
      this.hud.banner('GOOOOL!', 2800, 'goal');
      scorer.celebrateType = this.opts.celebration || 'aeroplano';
      this.confetti(side * (HL - 4), 0, [this.opts.kits[0].c1, this.opts.kits[0].c2, '#ffe14d', '#ffffff']);
    } else {
      Audio.cheer(false); this.world.excite = 0.35;
      this.comment(pick(CONCEDE_LINES), true);
      this.hud.banner('Gol avversario', 2200);
      scorer.celebrateType = pick(['salto', 'aeroplano']);
    }
    scorer.celebrateT = 3.6;
    this.celebDir = new THREE.Vector3(side * (HL - 6) - scorer.pos.x, 0, (scorer.pos.z >= 0 ? HW - 3 : -HW + 3) - scorer.pos.z).normalize();
    this.world.updateScoreboard(this.score[0], this.score[1], this.clockText(), team === 0 ? 'GOOOOL DI ANDREA!' : 'GOL');
  }

  goalStep(dt) {
    const b = this.ball;
    b.step(dt); b.events.length = 0;
    const s = this.scorer;
    for (const p of this.players) p.cooldown = 1;
    // il marcatore corre verso la bandierina, i compagni lo raggiungono
    if (this.phaseT < 2.6) this.steer(s, this.celebDir.x * 5.5, this.celebDir.z * 5.5, dt, 10);
    else this.steer(s, 0, 0, dt, 10);
    s.celebrateT = Math.max(0.5, s.celebrateT - dt);
    for (const p of this.teams[this.goalTeam]) {
      if (p === s || p.isKeeper) continue;
      this.moveTowards(p, s.pos.x - this.celebDir.x * 1.5 + (p.idx - 3) * 0.8, s.pos.z - this.celebDir.z * 1.5, 6, dt);
      if (this.phaseT > 1.5) { p.celebrateT = 1; p.celebrateType = 'salto'; }
    }
    for (const p of this.teams[1 - this.goalTeam]) { p.vel.multiplyScalar(0.92); p.pos.addScaledVector(p.vel, dt); }
    if (this.phaseT > 1.0 && !this.replaySaved) {
      this.replaySaved = true;
      this.replayFrames = this.replayBuf.slice(-110);
    }
    if (this.phaseT > 3.6) {
      for (const p of this.players) p.celebrateT = 0;
      if (this.replayFrames && this.replayFrames.length > 30 && !this.opts.noReplay) {
        this.phase = 'replay'; this.phaseT = 0; this.replayIdx = 0;
        this.hud.replay(true);
      } else this.afterGoal();
    }
  }

  skipReplay() { if (this.phase === 'replay') { this.hud.replay(false); this.afterGoal(); } }

  afterGoal() {
    this.setKickoff(1 - this.goalTeam);
    this.phase = 'kickoff'; this.phaseT = -0.6;
    this.world.updateScoreboard(this.score[0], this.score[1], this.clockText(), '');
    this.replayBuf.length = 0;
  }

  recordFrame() {
    if (this.frame % 2) return;
    const b = this.ball;
    const q = b.mesh.quaternion;
    this.replayBuf.push({ b: [b.pos.x, b.pos.y, b.pos.z, q.x, q.y, q.z, q.w], p: this.players.map(p => p.pose()) });
    if (this.replayBuf.length > 220) this.replayBuf.shift();
  }

  replayStep(dt) {
    this.replayIdx += dt * 30 * 0.7;
    if (this.replayIdx >= this.replayFrames.length - 1 || input.tap) {
      this.hud.replay(false);
      this.afterGoal();
    }
  }

  clockText() {
    const m = Math.min(90, Math.floor(this.clock / this.total * 90));
    return m + "'";
  }

  // ---------------- grafica ----------------
  visual(dt) {
    const b = this.ball;
    if (this.phase === 'replay') {
      const f = this.replayFrames[Math.min(this.replayFrames.length - 1, Math.floor(this.replayIdx))];
      this.players.forEach((p, i) => p.applyPose(f.p[i]));
      b.mesh.position.set(f.b[0], f.b[1], f.b[2]); b.mesh.quaternion.set(f.b[3], f.b[4], f.b[5], f.b[6]);
      b.shadow.position.set(f.b[0], 0.025, f.b[2]);
      this.placeIndicator(null);
      const side = this.goalTeam === 0 ? 1 : -1;
      const k = this.replayIdx / this.replayFrames.length;
      const camPos = k < 0.55
        ? new THREE.Vector3(f.b[0] - side * 9, 4.5, f.b[2] + 10)
        : new THREE.Vector3(side * (HL + 9), 3.2, f.b[2] * 0.4 + 5);
      this.setCam(camPos, new THREE.Vector3(f.b[0], 1, f.b[2]), dt, 4);
      return;
    }
    for (const p of this.players) p.animate(dt);
    b.sync(dt);
    const showInd = this.phase === 'play' || this.phase === 'kickoff';
    this.placeIndicator(showInd ? this.controlled : null, this.t);
    // camera
    if (this.phase === 'intro') {
      const a = this.phaseT * 0.35;
      this.setCam(new THREE.Vector3(Math.sin(a - 1) * 45, 20 - this.phaseT * 2, Math.cos(a - 1) * 45), new THREE.Vector3(0, 0, 0), dt, 2);
    } else if (this.phase === 'goal' || (this.phase === 'end' && this.score[0] > this.score[1])) {
      const s = this.phase === 'goal' ? this.scorer : this.andrea;
      const a = this.t * 0.5;
      this.setCam(new THREE.Vector3(s.pos.x + Math.sin(a) * 7, 3.2, s.pos.z + Math.cos(a) * 7), new THREE.Vector3(s.pos.x, 1.2, s.pos.z), dt, 2.5);
    } else {
      const focus = b.owner ? b.owner.pos : b.pos;
      // zoom dinamico vicino alle porte
      const nearGoal = Math.abs(focus.x) > HL - 16 ? 0.86 : 1;
      this.broadcastCam(dt, focus, nearGoal);
    }
    // HUD
    const has = b.owner === this.controlled && this.phase === 'play';
    this.hud.labels(has || (this.controlled.frozen));
    this.hud.power(has ? this.charge() : 0);
    if (this.phase === 'play' && this.frame % 30 === 0) {
      const ct = this.clockText();
      this.hud.clock(ct);
      if (ct !== this._lastClock) { this._lastClock = ct; this.world.updateScoreboard(this.score[0], this.score[1], ct, ''); }
    }
  }
}
