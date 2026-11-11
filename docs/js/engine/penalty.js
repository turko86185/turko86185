// CALCI DI RIGORE: Andrea tira (mira + potenza) e para (sceglie dove tuffarsi).
import { BaseGame, THREE, FIELD, BALL_R, input, clamp, rand, pick } from './core.js';
import * as Audio from '../audio.js';

const HL = FIELD.HL;
const SPOT = HL - FIELD.PEN;

export class PenaltyGame extends BaseGame {
  constructor(renderer, opts, hud) {
    super(renderer, opts, hud);
    this.practice = !!opts.practice;           // allenamento: solo tiri
    this.maxKicks = this.practice ? 10 : 5;
    this.shooters = [opts.rosters[0].slice(1).reverse(), opts.rosters[1].slice(1).reverse()];
    this.userGK = this.addPlayer(opts.rosters[0][0], opts.kits[0], 0, true);
    this.oppGK = this.addPlayer(opts.rosters[1][0], opts.kits[1], 1, true);
    this.kickers = [this.shooters[0].map(i => this.addPlayer(i, opts.kits[0], 0, false)), this.shooters[1].map(i => this.addPlayer(i, opts.kits[1], 1, false))];
    this.res = [[], []];
    this.turn = 0;      // 0 = tira Andrea, 1 = tira il computer
    this.round = 0;
    this.t = 0;
    // mirino sulla porta
    const rc = document.createElement('canvas'); rc.width = rc.height = 128;
    const g = rc.getContext('2d');
    g.strokeStyle = '#ffe14d'; g.lineWidth = 10; g.beginPath(); g.arc(64, 64, 48, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 6; g.beginPath(); g.moveTo(64, 4); g.lineTo(64, 40); g.moveTo(64, 88); g.lineTo(64, 124); g.moveTo(4, 64); g.lineTo(40, 64); g.moveTo(88, 64); g.lineTo(124, 64); g.stroke();
    this.reticle = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(rc), depthTest: false, transparent: true }));
    this.reticle.scale.set(0.9, 0.9, 1); this.reticle.renderOrder = 20;
    this.scene.add(this.reticle);
    this.aim = { z: 0, y: 1.1, sway: 0 };
    Audio.crowdStart();
    hud.pens(this.res, this.maxKicks);
    this.nextKick();
  }

  layout() {
    // tutti i giocatori in attesa al centro del campo
    this.kickers.forEach((arr, t) => arr.forEach((p, i) => {
      p.pos.set(4 + i * 1.1, 0, (t ? 2.5 : -2.5)); p.vel.set(0, 0, 0); p.facing = Math.PI / 2; p.celebrateT = 0; p.kickT = 0;
    }));
    // portiere "in panchina" vicino al centro
    const idle = this.turn === 0 ? this.userGK : this.oppGK;
    idle.pos.set(2, 0, this.turn === 0 ? -4.5 : 4.5); idle.facing = Math.PI / 2; idle.diveT = 0; idle.plan = null;
  }

  nextKick() {
    this.layout();
    const t = this.turn;
    const shooter = this.kickers[t][this.round % this.kickers[t].length];
    if (t === 0 && this.round === 0) { /* Andrea tira per primo */ }
    this.shooter = t === 0 ? this.andreaKicker() : shooter;
    this.gk = t === 0 ? this.oppGK : this.userGK;
    this.gk.pos.set(HL - 0.3, 0, 0); this.gk.vel.set(0, 0, 0); this.gk.facing = -Math.PI / 2;
    this.gk.diveT = 0; this.gk.plan = null; this.gk.saveIntent = false; this.gk.ignoreT = 0; this.gk.holdT = 0; this.gk.shotId = -1;
    const b = this.ball;
    b.owner = null; b.vel.set(0, 0, 0); b.pos.set(SPOT, BALL_R, 0); b.inNet = 0; b.lastKickTeam = -1; b.lastTouch = null;
    this.shooter.pos.set(SPOT - 2.6, 0, -1.2); this.shooter.facing = Math.atan2(2.6, 1.2); this.shooter.vel.set(0, 0, 0);
    this.phase = t === 0 ? 'aim' : 'defend'; this.phaseT = 0; this.diveChoice = null; this.result = null;
    this.aim = { z: 0, y: 1.1, sway: Math.random() * 6 };
    if (t === 0) {
      this.hud.banner(this.practice ? `Rigore ${this.round + 1} di ${this.maxKicks}` : 'Tocca a te! Mira e tieni premuto TIRA', 2200);
      this.hud.hint('Muovi il mirino con il joystick, tieni premuto TIRA e lascia!');
      this.hud.diveButtons(false);
      this.hud.mode('shoot');
    } else {
      this.hud.banner('Para il rigore! Scegli dove tuffarti', 2200);
      this.hud.hint('Tocca una freccia per tuffarti!');
      this.hud.diveButtons(true);
      this.hud.mode('dive');
      this.aiTarget = { z: Math.random() < 0.15 ? rand(-0.4, 0.4) : (Math.random() < 0.5 ? -1 : 1) * FIELD.GOAL_W * rand(0.45, 0.85), y: rand(0.3, 1.8) };
    }
  }

  andreaKicker() {
    // Andrea è il numero 10 della squadra
    const all = this.kickers[0];
    const a = all.find(p => p.info.number === 10) || all[0];
    return a;
  }

  chooseDive(dir) {
    // dir: -1 sinistra, 0 centro, 1 destra (dal punto di vista del bambino, dietro la porta)
    if (this.phase !== 'defend' || this.diveChoice !== null) return;
    this.diveChoice = dir;
    Audio.sfx('click');
  }

  fixed(dt) {
    this.t += dt; this.phaseT += dt;
    const b = this.ball, s = this.shooter, gk = this.gk;
    for (const p of this.players) { p.kickT = Math.max(0, p.kickT - dt); p.celebrateT = Math.max(0, p.celebrateT - dt); p.diveT = Math.max(0, p.diveT - dt); }
    if (this.phase === 'aim') {
      // il mirino oscilla dolcemente; il joystick lo sposta
      this.aim.sway += dt;
      const j = this.joyWorld();
      const W = FIELD.GOAL_W - 0.3, H = FIELD.GOAL_H - 0.25;
      if (j.m > 0.15) { this.aim.z = clamp(this.aim.z + j.x * dt * 4.2, -W, W); this.aim.y = clamp(this.aim.y - j.z * dt * 3, 0.3, H); }
      else if (!input.shootHeld) { this.aim.z = clamp(this.aim.z + Math.cos(this.aim.sway * 1.1) * dt * 2.2, -W, W); }
      if (input.shoot) { this.power = Math.max(0.3, input.shootPower); this.phase = 'runup'; this.phaseT = 0; this.hud.hint(''); }
    } else if (this.phase === 'runup' || this.phase === 'defend') {
      if (this.phase === 'defend' && this.phaseT < 1.2) { s.vel.set(0, 0, 0); this.readDiveKeys(); return; }
      if (this.phase === 'defend') this.readDiveKeys();
      // rincorsa
      const tx = SPOT - 0.55, tz = -0.25;
      this.moveTowards(s, tx, tz, 4.2, dt);
      s.facing = Math.PI / 2 - 0.15;
      if (Math.hypot(s.pos.x - tx, s.pos.z - tz) < 0.25) this.kick();
    } else if (this.phase === 'flight') {
      b.step(dt);
      for (const [ev, v] of b.events) { if (ev === 'bounce') Audio.sfx('bounce', v); if (ev === 'post') { Audio.sfx('post'); this.result = this.result || 'palo'; } }
      b.events.length = 0;
      const out = -1;
      this.keeperThink(gk, HL, out, dt, this.gkParams);
      const r = this.keeperContact(gk, out);
      if (r) { this.result = 'parato'; if (r === 'catch') b.owner = gk; }
      if (b.owner === gk) { b.pos.set(gk.pos.x - 0.4, 1, gk.pos.z); }
      // gol
      if (b.pos.x > HL + BALL_R && Math.abs(b.pos.z) < FIELD.GOAL_W && b.pos.y < FIELD.GOAL_H && b.inNet && !this.result) {
        this.result = 'gol';
        this.world.netHit(1, b.pos.z, b.pos.y, Math.hypot(b.vel.x, b.vel.z) / 18);
        Audio.sfx('net');
      }
      if (this.phaseT > 2.0 || (b.pos.x > HL + 1 && !b.inNet) || (this.result && this.phaseT > 0.9)) this.resolve();
    } else if (this.phase === 'result') {
      if (!b.owner) b.step(dt); b.events.length = 0;
      if (this.phaseT > 2.6) this.advance();
    } else if (this.phase === 'end') {
      if (this.won && Math.floor(this.phaseT * 2.5) !== Math.floor((this.phaseT - dt) * 2.5)) this.firework(rand(15, 45), rand(12, 20), rand(-25, 25), pick([0xffe14d, 0xff4f6d, 0x4fb3ff]));
      if (this.phaseT > 3.5 && !this.done) { this.done = true; this.hud.end(this.summary()); }
    }
  }

  readDiveKeys() {
    if (input.x < -0.5) this.chooseDive(-1);
    else if (input.x > 0.5) this.chooseDive(1);
    else if (input.y < -0.5 || input.shoot) this.chooseDive(0);
  }

  kick() {
    const b = this.ball, s = this.shooter, gk = this.gk;
    let tz, ty, speed;
    if (this.turn === 0) {
      const p = this.power;
      tz = this.aim.z; ty = this.aim.y; speed = 15 + p * 12;
      const err = this.assisted ? 0.12 : 0.35 + (1 - s.info.shot) * 0.6;
      tz += rand(-err, err); ty += rand(-err, err) * 0.6;
      if (!this.assisted && p > 0.96) ty += 0.9; // troppo forte: rischio di tirare alto
      this.gkParams = { save: this.diff.gkSave * 0.7 * (this.assisted ? 0.65 : 1), reach: this.diff.gkReach, speed: 1 };
    } else {
      tz = this.aiTarget.z; ty = this.aiTarget.y; speed = 16 + s.info.shot * 6;
      const miss = Math.random() < (this.assisted ? 0.14 : 0.07);
      if (miss) { tz = Math.sign(tz || 1) * (FIELD.GOAL_W + rand(0.3, 1)); }
      // il bambino ha scelto? (destra dello schermo = -z vista da dietro la porta)
      const choice = this.diveChoice;
      let save = false;
      if (choice !== null) {
        const side = Math.abs(tz) < 0.9 ? 0 : (tz < 0 ? 1 : -1);
        if (side === choice) save = Math.random() < (this.assisted ? 0.95 : 0.78) - (ty > 1.9 ? 0.2 : 0);
      } else save = Math.random() < 0.15;
      this.gkParams = { forceSave: save, save: 0, reach: 3, speed: 1.2 };
      this.forcedDiveZ = choice === null ? 0 : choice === 0 ? 0 : -choice * FIELD.GOAL_W * 0.7;
    }
    const v = this.shotVelocity(b.pos, HL + 0.6, ty, tz, speed);
    this.doKick(s, v, 0.9);
    this.phase = 'flight'; this.phaseT = 0;
    // il portiere controllato dal bambino si tuffa dove ha scelto (anche se sbaglia)
    if (this.turn === 1) {
      const t = (HL - b.pos.x) / v.x;
      const save = this.gkParams.forceSave;
      const pz = b.pos.z + v.z * t; let py = b.pos.y + v.y * t - 5.5 * t * t; if (py < 0.3) py = 0.4;
      gk.shotId = b.kickId;
      const zt = save ? pz : this.forcedDiveZ;
      gk.saveIntent = save;
      gk.plan = { z: zt, y: py, t, x: HL - 0.45 };
      if (!save) gk.ignoreT = 3;
      const lateral = zt - gk.pos.z;
      if (Math.abs(lateral) > 0.6) { gk.diveT = 0.9; gk.diveDir = Math.sign(lateral) * 1; gk.diveHeight = clamp((py - 0.6) * 0.6, 0, 0.9); }
      this.hud.diveButtons(false);
    }
  }

  resolve() {
    if (this.phase !== 'flight') return;
    const r = this.result === 'gol' ? 'gol' : this.result === 'parato' ? 'parato' : 'fuori';
    const scored = r === 'gol';
    this.res[this.turn].push(scored);
    this.hud.pens(this.res, this.maxKicks);
    this.phase = 'result'; this.phaseT = 0;
    if (this.turn === 0) {
      if (scored) {
        this.hud.banner('GOOOOL!', 2200, 'goal'); Audio.cheer(true); this.world.excite = 1;
        Audio.say(pick(['GOOOOOL DI ANDREA!', 'Rigore perfetto! Gol di Andrea!', 'Che tiro incredibile!']));
        this.shooter.celebrateT = 2.4; this.shooter.celebrateType = this.opts.celebration || 'aeroplano';
        this.confetti(HL - 3, 0, [this.opts.kits[0].c1, this.opts.kits[0].c2, '#ffe14d'], 90);
      } else {
        this.hud.banner(r === 'parato' ? 'Parato!' : 'Fuori!', 2000);
        Audio.ooh(); Audio.say(r === 'parato' ? 'Grandissima parata! Riprova Andrea, ce la farai!' : 'Di poco fuori! Riprova Andrea!');
      }
    } else {
      if (!scored) {
        this.hud.banner(r === 'parato' ? 'PARATO DA ANDREA!' : 'Fuori!', 2200, 'goal'); Audio.cheer(true); this.world.excite = 0.8;
        Audio.say(r === 'parato' ? 'Grandissima parata di Andrea!' : 'Fuori! Che fortuna!');
        if (r === 'parato') { this.saves = (this.saves || 0) + 1; this.gk.celebrateT = 2; this.gk.celebrateType = 'salto'; }
      } else {
        this.hud.banner('Gol avversario', 1800); Audio.say('Gol. Non importa, il prossimo lo pari!');
        this.shooter.celebrateT = 2; this.shooter.celebrateType = 'salto';
      }
    }
  }

  advance() {
    const [a, b] = [this.res[0].filter(Boolean).length, this.res[1].filter(Boolean).length];
    if (this.practice) {
      if (this.res[0].length >= this.maxKicks) return this.finish();
      this.round++; this.nextKick(); return;
    }
    const na = this.res[0].length, nb = this.res[1].length;
    // fine anticipata: una squadra non può più rimontare
    if (na <= 5 && nb <= 5) {
      const remA = 5 - na, remB = 5 - nb;
      if (a > b + remB || b > a + remA) return this.finish();
    }
    if (na === nb && na >= 5 && a !== b) return this.finish();
    if (this.turn === 0) this.turn = 1; else { this.turn = 0; this.round++; }
    if (na === nb && na >= 5) this.hud.banner('Si va a oltranza!', 1500);
    this.nextKick();
  }

  finish() {
    this.phase = 'end'; this.phaseT = 0;
    this.hud.diveButtons(false); this.hud.hint('');
    const a = this.res[0].filter(Boolean).length, b = this.res[1].filter(Boolean).length;
    this.won = this.practice ? a >= 5 : a > b;
    Audio.sfx('whistle3');
    if (this.practice) {
      this.hud.banner(`${a} gol su ${this.maxKicks}!`, 3000, a >= 5 ? 'win' : '');
      Audio.say(a >= 7 ? 'Fantastico! Sei un bomber!' : a >= 4 ? 'Bravissimo Andrea!' : 'Bravo! Allenandoti diventerai fortissimo!');
    } else if (this.won) {
      this.hud.banner('HAI VINTO AI RIGORI!', 3200, 'win'); Audio.cheer(true); this.world.excite = 1;
      Audio.say('Andrea vince ai rigori! Sei il re dei rigori!');
      this.kickers[0].forEach(p => { p.celebrateT = 4; p.celebrateType = 'salto'; });
      this.confetti(HL - 6, 0, [this.opts.kits[0].c1, this.opts.kits[0].c2, '#ffe14d']);
    } else {
      this.hud.banner('Bravo lo stesso!', 3200);
      Audio.say("Che bella sfida! Andiamo campione, un'altra serie di rigori!");
    }
  }

  summary() {
    const a = this.res[0].filter(Boolean).length, b = this.res[1].filter(Boolean).length;
    return { mode: 'penalty', practice: this.practice, gf: a, ga: b, won: this.won, saves: this.saves || 0, kicks: this.res[0].length };
  }

  visual(dt) {
    for (const p of this.players) p.animate(dt);
    this.ball.sync(dt);
    this.placeIndicator(null);
    const aimVis = this.phase === 'aim' || (this.phase === 'runup' && this.turn === 0);
    this.reticle.visible = aimVis;
    if (aimVis) {
      this.reticle.position.set(HL + 0.05, this.aim.y, this.aim.z);
      const s = 0.9 + Math.sin(this.t * 6) * 0.06; this.reticle.scale.set(s, s, 1);
    }
    this.hud.power(this.phase === 'aim' ? this.charge() : 0);
    // camera
    if (this.phase === 'end') {
      const a = this.t * 0.3;
      this.setCam(new THREE.Vector3(HL - 10 + Math.sin(a) * 12, 6, Math.cos(a) * 12), new THREE.Vector3(HL - 8, 1, 0), dt, 1.5);
    } else if (this.turn === 0 || this.phase === 'result' && this.turn === 0) {
      const follow = this.phase === 'flight' || this.phase === 'result';
      const pos = follow ? new THREE.Vector3(SPOT - 6.5, 3.0, 1.6 + this.ball.pos.z * 0.3) : new THREE.Vector3(SPOT - 8, 3.3, 2.2);
      this.setCam(pos, new THREE.Vector3(HL, 1.1, 0), dt, 3);
    } else {
      this.setCam(new THREE.Vector3(HL + 5.2, 2.0, 0), new THREE.Vector3(SPOT, 0.9, 0), dt, 3);
    }
  }
}
