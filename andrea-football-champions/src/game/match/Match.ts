import { AdditiveBlending, BufferAttribute, BufferGeometry, CatmullRomCurve3, DoubleSide, Mesh, MeshBasicMaterial, Shape, ShapeGeometry, TubeGeometry, Vector3, TorusGeometry, Group } from 'three';

// stella del bersaglio
const STAR_GEO = (() => {
  const s = new Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.17 : 0.4;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return new ShapeGeometry(s);
})();
const STAR_MAT = new MeshBasicMaterial({ color: '#ffd60a', side: DoubleSide, depthTest: false, transparent: true });

/** Freccia gialla a terra lungo la traiettoria, con punta */
function arrowRibbon(pts: Vector3[], color: string): Mesh {
  const n = pts.length;
  const pos: number[] = [], alpha: number[] = [], idx: number[] = [];
  const end = n - 3;
  for (let i = 0; i <= end; i++) {
    const p = pts[i], q = pts[Math.min(n - 1, i + 1)];
    const dx = q.x - p.x, dz = q.z - p.z, L = Math.hypot(dx, dz) || 1;
    const nx = -dz / L, nz = dx / L;
    const w = 0.12 + 0.14 * (i / end);
    pos.push(p.x + nx * w, p.y, p.z + nz * w, p.x - nx * w, p.y, p.z - nz * w);
    const a = 0.15 + 0.85 * (i / end);
    alpha.push(a, a);
    if (i < end) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  // punta della freccia
  const p = pts[end], tip = pts[n - 1];
  const dx = tip.x - p.x, dz = tip.z - p.z, L = Math.hypot(dx, dz) || 1;
  const nx = -dz / L, nz = dx / L, W = 0.55;
  const b = pos.length / 3;
  pos.push(p.x + nx * W, p.y, p.z + nz * W, p.x - nx * W, p.y, p.z - nz * W, tip.x + (dx / L) * 0.4, p.y, tip.z + (dz / L) * 0.4);
  alpha.push(1, 1, 1);
  idx.push(b, b + 1, b + 2);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  const col: number[] = [];
  alpha.forEach((a) => col.push(1, 0.88 * a + 0.1, 0.2 * a));
  geo.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  geo.setIndex(idx);
  const m = new Mesh(geo, new MeshBasicMaterial({ color, vertexColors: true, transparent: true, opacity: 0.92, side: DoubleSide, depthWrite: false }));
  m.renderOrder = 5;
  return m;
}
import { Engine } from '../engine/Engine';
import { Player } from '../engine/Player';
import { BallMesh } from '../engine/BallMesh';
import { BallPhysics, type BallEvent } from '../physics/BallPhysics';
import { BALL_R, FIELD, GOAL } from '../physics/constants';
import { planKick, sampleTrajectory, type KickPlan } from '../trajectory/TrajectoryPlanner';
import { GoalkeeperAI } from '../ai/Goalkeeper';
import { DefenderAI } from '../ai/Defender';
import { Audio } from '../audio/AudioManager';
import type { Kit } from '../teams/teams';
import type { Scenario } from '../levels/levels';
import type { BallSkin } from '../save/rewards';

export type OutcomeKind = 'goal' | 'saved' | 'intercepted' | 'miss' | 'lost';
export interface Outcome {
  kind: OutcomeKind;
  passes: number;
  curve: boolean; corner: boolean; header: boolean; long: boolean; beatDefender: boolean; post: boolean;
  goalPoint?: Vector3;
  targetHit?: number; // allenamento: indice del bersaglio colpito
  scorer?: Player;
}

export interface MatchConfig {
  scenario: Scenario;
  attackKit: Kit; defendKit: Kit; attackKeeperKit: Kit; defendKeeperKit: Kit;
  difficulty: number;
  assist: number;
  mode: 'normal' | 'penalty' | 'penaltyDefend' | 'training';
  targets?: { y: number; z: number; r: number }[];
  hint?: boolean;
  playerNames?: string[];
}

export interface MatchEvents {
  onState?: (s: MatchState) => void;
  onBanner?: (text: string, kind?: 'good' | 'info' | 'bad') => void;
  onPass?: (count: number, beatDefender: boolean) => void;
  onKick?: (plan: KickPlan) => void;
  onOutcome?: (o: Outcome) => void;
}

export type MatchState = 'intro' | 'aim' | 'kicking' | 'flight' | 'outcome' | 'idle';

/**
 * Gestisce un'azione di gioco: giocatori, pallone, disegno della traiettoria, IA, esiti.
 */
export class Match {
  ball = new BallPhysics();
  ballMesh: BallMesh;
  attackers: Player[] = [];
  defenders: Player[] = [];
  keeper: Player | null = null;
  keeperAI: GoalkeeperAI | null = null;
  defAI: DefenderAI[] = [];
  carrier: Player | null = null;
  receiver: Player | null = null;
  state: MatchState = 'idle';
  private plan: KickPlan | null = null;
  private passes = 0;
  private flags = { curve: false, header: false, long: false, beatDefender: false, post: false };
  private airborne = false;
  private stateT = 0;
  private trail: Mesh | null = null;
  private trailT = 0;
  private targets: Group | null = null;
  private loose = false;
  private looseT = 0;
  private kickers: Player[] = [];
  private unsub: () => void;
  cfg!: MatchConfig;
  private outcomeSent = false;
  private aiPenaltyPlan: KickPlan | null = null;
  private kickTime = 0;

  constructor(public engine: Engine, ballSkin: BallSkin, public ev: MatchEvents = {}) {
    this.ballMesh = new BallMesh(ballSkin);
    engine.scene.add(this.ballMesh.group);
    this.unsub = engine.onUpdate((dt, t) => this.update(dt, t));
  }

  get canDraw() { return this.state === 'aim' && !!this.carrier && this.cfg.mode !== 'penaltyDefend'; }

  setState(s: MatchState) { this.state = s; this.stateT = 0; this.ev.onState?.(s); }

  clearPlayers() {
    for (const p of [...this.attackers, ...this.defenders, ...(this.keeper ? [this.keeper] : [])]) this.engine.scene.remove(p.object);
    this.attackers = []; this.defenders = []; this.keeper = null; this.keeperAI = null; this.defAI = [];
    if (this.targets) { this.engine.scene.remove(this.targets); this.targets = null; }
  }

  /** Prepara un'azione a partire da uno scenario */
  setup(cfg: MatchConfig) {
    this.cfg = cfg;
    this.clearPlayers();
    this.removeTrail();
    const sc = cfg.scenario;
    const names = cfg.playerNames ?? [];
    sc.attackers.forEach(([x, z], i) => {
      const p = new Player(i, 'att', 'player', cfg.attackKit, [9, 10, 7, 11, 8][i % 5], i * 3 + 1);
      p.name = names[i] ?? '';
      p.maxSpeed = 7.2;
      p.setPos(x, z);
      p.faceTo(new Vector3(GOAL.x, 0, 0), true);
      this.engine.scene.add(p.object);
      this.attackers.push(p);
    });
    sc.defenders.forEach(([x, z], i) => {
      const p = new Player(100 + i, 'def', 'player', cfg.defendKit, [4, 5, 3, 2, 6][i % 5], i * 5 + 2);
      p.setPos(x, z);
      const ai = new DefenderAI(p, cfg.difficulty);
      ai.setHome(x, z);
      this.engine.scene.add(p.object);
      this.defenders.push(p);
      this.defAI.push(ai);
    });
    if (sc.keeper) {
      const k = new Player(200, 'def', 'keeper', cfg.defendKeeperKit, 1, 11);
      this.keeper = k;
      this.keeperAI = new GoalkeeperAI(k, cfg.difficulty);
      this.engine.scene.add(k.object);
    }
    if (cfg.targets) this.buildTargets(cfg.targets);
    this.passes = 0;
    this.kickers = [];
    this.plan = null;
    this.flags = { curve: false, header: false, long: false, beatDefender: false, post: false };
    this.airborne = false;
    this.outcomeSent = false;
    this.loose = false;
    this.ball.reset(new Vector3());
    this.engine.stadium.setExcitement(0);
    Audio.crowdLevel(0.12);

    if (sc.looseBall) {
      // pallone vagante: il nostro giocatore deve andarlo a prendere
      this.carrier = null;
      this.ball.reset(new Vector3(sc.looseBall[0], BALL_R, sc.looseBall[1]));
      this.ball.release(new Vector3(-1.5, 2.5, 0.5));
      this.loose = true;
      this.looseT = 0;
      this.attackers[0].target = this.ball.pos.clone().setY(0);
      this.keeperAI?.idle(this.ball.pos, true);
      this.engine.director.set('follow', this.ball.pos);
      this.engine.director.snap();
      this.setState('flight');
      this.ev.onBanner?.('Corri a prendere il pallone!', 'info');
      return;
    }
    this.giveBall(this.attackers[0]);
    this.keeperAI?.idle(this.ball.pos, true);
    if (cfg.mode === 'penaltyDefend') this.setupPenaltyDefend();
    this.enterAim(true);
    this.setState('intro');
    Audio.play('whistle');
  }

  private buildTargets(ts: { y: number; z: number; r: number }[]) {
    const g = new Group();
    ts.forEach((t, i) => {
      const m = new Mesh(new TorusGeometry(t.r, 0.06, 8, 32), new MeshBasicMaterial({ color: ['#ffd700', '#ff4d6d', '#4dd2ff'][i % 3], transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false }));
      m.rotation.y = Math.PI / 2;
      m.position.set(GOAL.x + 0.05, t.y, t.z);
      g.add(m);
    });
    this.targets = g;
    this.engine.scene.add(g);
  }

  private giveBall(p: Player) {
    this.carrier = p;
    this.receiver = null;
    this.ball.hold(p.footPoint());
  }

  private enterAim(snap = false) {
    const c = this.carrier!;
    if (this.cfg.mode !== 'penaltyDefend') c.faceTo(new Vector3(GOAL.x, 0, 0));
    for (const a of this.attackers) if (a !== c) { a.target = null; a.faceTo(c.pos); }
    for (let i = 0; i < this.defAI.length; i++) this.defAI[i].idle(this.ball.pos, new Vector3(GOAL.x, 0, 0));
    this.keeperAI?.reset();
    this.keeperAI?.idle(this.ball.pos, snap);
    this.attackers.forEach((a) => a.highlight(0));
    c.highlight(0.9, '#ffe14d');
    const sc = this.cfg.scenario;
    if (sc.highlight !== undefined && this.attackers[sc.highlight] && this.attackers[sc.highlight] !== c && this.passes === 0) this.attackers[sc.highlight].highlight(0.8, '#4dff88');
    else this.attackers.forEach((a) => a !== c && a.highlight(0.5, '#4dff88'));
    const interest = this.attackers.filter((a) => a !== c).map((a) => a.pos.clone().setY(1));
    const mode = this.cfg.mode === 'penalty' ? 'penalty' : this.cfg.mode === 'penaltyDefend' ? 'keeper' : 'aim';
    this.engine.director.set(mode, c.pos.clone(), interest);
    if (snap) this.engine.director.snap();
    this.engine.stadium.focus(c.pos);
    if (this.state !== 'intro') this.setState('aim');
  }

  /** Il bambino ha finito di disegnare. path: punti a terra; goalPoint: rilascio sullo specchio */
  private makePlan(path: Vector3[], goalPoint: Vector3 | null, gestureSpeed: number): KickPlan | null {
    if (!this.carrier) return null;
    const c = this.carrier;
    const plan = planKick({
      ballPos: this.ball.pos.clone(),
      path, goalPoint,
      teammates: this.attackers.filter((a) => a !== c).map((a) => ({ id: a.id, pos: a.pos })),
      opponents: this.defenders.map((d) => ({ pos: d.pos })),
      keeperPos: this.keeper?.pos ?? null,
      assist: this.cfg.assist,
      gestureSpeed,
      canShoot: true,
      airborne: this.airborne
    });
    if (plan && this.cfg.mode === 'penalty' && !plan.isShot && path.length) {
      // ai rigori si tira sempre in porta
      return this.makePlan(path, goalPoint ?? new Vector3(GOAL.x, 0.5, Math.max(-3, Math.min(3, path[path.length - 1].z))), gestureSpeed);
    }
    return plan;
  }

  /** Il bambino ha finito di disegnare. path: punti a terra; goalPoint: rilascio sullo specchio */
  submitPath(path: Vector3[], goalPoint: Vector3 | null, gestureSpeed: number): KickPlan | null {
    this.clearPreview();
    if (!this.canDraw || !this.carrier) return null;
    const plan = this.makePlan(path, goalPoint, gestureSpeed);
    if (!plan) { this.ev.onBanner?.('Disegna una linea più lunga!', 'info'); return null; }
    this.kick(this.carrier, plan);
    return plan;
  }

  // ---------------- anteprima della mira: freccia gialla e stella sul bersaglio ----------------
  private preview: Group | null = null;
  previewPath(path: Vector3[], goalPoint: Vector3 | null, gestureSpeed: number) {
    if (!this.canDraw || !this.carrier) return;
    const plan = this.makePlan(path, goalPoint, gestureSpeed);
    this.clearPreview();
    if (!plan) return;
    const g = new Group();
    const pts = sampleTrajectory(plan, 30).map((p) => new Vector3(p.x, 0.04, p.z));
    g.add(arrowRibbon(pts, plan.isShot ? '#ffe14d' : '#ffe14d'));
    if (plan.isShot) {
      const star = new Mesh(STAR_GEO, STAR_MAT);
      star.position.copy(plan.target).setX(GOAL.x - 0.05);
      star.rotation.y = -Math.PI / 2;
      g.add(star);
    } else if (plan.receiverId !== null) {
      const r = this.attackers.find((a) => a.id === plan.receiverId);
      r?.highlight(1, '#ffe14d');
    }
    this.preview = g;
    this.engine.scene.add(g);
  }

  clearPreview() {
    if (this.preview) {
      this.engine.scene.remove(this.preview);
      this.preview.traverse((o: any) => { if (o.geometry && o.geometry !== STAR_GEO) o.geometry.dispose(); });
      this.preview = null;
    }
  }

  private kick(c: Player, plan: KickPlan) {
    this.plan = plan;
    if (this.kickerOf() !== c) this.kickers.push(c);
    this.kickTime = this.engine.time;
    this.setState('kicking');
    c.faceTo(plan.target, true);
    c.highlight(0);
    this.attackers.forEach((a) => a.highlight(0));
    if (plan.receiverId !== null) {
      const r = this.attackers.find((a) => a.id === plan.receiverId) ?? null;
      this.receiver = r;
      r?.highlight(0.7, '#4dff88');
    } else this.receiver = null;
    const launch = () => {
      if (plan.isShot && c.pos.x < GOAL.x - FIELD.boxDepth) this.flags.long = true;
      if (plan.curveAmount > 0.8 && plan.isShot) this.flags.curve = true;
      this.flags.header = plan.type === 'header';
      this.ball.launch(plan);
      Audio.play(plan.isShot ? 'kick' : 'pass', 0.6 + plan.power * 0.6);
      this.showTrail(plan);
      this.ev.onKick?.(plan);
      for (const d of this.defAI) d.onKick(plan);
      if (plan.isShot && this.keeperAI) this.keeperAI.onShot(plan);
      else if (this.keeperAI) this.keeperAI.idle(plan.target);
      if (this.receiver) {
        // il compagno va incontro al pallone
        this.receiver.target = plan.target.clone().setY(0);
        this.receiver.maxSpeed = Math.max(7, this.receiver.pos.distanceTo(plan.target) / Math.max(0.4, plan.T) + 0.5);
      }
      this.carrier = null;
      this.airborne = false;
      this.setState('flight');
      this.engine.director.set('follow', this.ball.pos);
      if (plan.isShot) this.engine.timeScale = 1;
    };
    if (plan.type === 'header') {
      c.play('header', { onContact: launch, force: true });
      c.locked = true;
      setTimeout(() => (c.locked = false), 900);
    } else {
      c.play(plan.isShot ? 'kick' : 'pass', { onContact: launch, force: true });
      c.locked = true;
      setTimeout(() => (c.locked = false), 600);
    }
  }

  private showTrail(plan: KickPlan) {
    this.removeTrail();
    const pts = sampleTrajectory(plan, 40);
    if (pts.length < 2) return;
    pts.forEach((p) => (p.y = Math.max(p.y, 0.08)));
    const curve = new CatmullRomCurve3(pts);
    const geo = new TubeGeometry(curve, 80, 0.045, 6, false);
    const mat = new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false });
    this.trail = new Mesh(geo, mat);
    this.trailT = 0;
    this.engine.scene.add(this.trail);
  }

  private removeTrail() {
    if (this.trail) { this.engine.scene.remove(this.trail); this.trail.geometry.dispose(); this.trail = null; }
  }

  private endWith(kind: OutcomeKind, extra: Partial<Outcome> = {}) {
    if (this.outcomeSent) return;
    this.outcomeSent = true;
    this.setState('outcome');
    this.engine.timeScale = 1;
    const o: Outcome = { kind, passes: this.passes, curve: this.flags.curve, corner: false, header: this.flags.header, long: this.flags.long, beatDefender: this.flags.beatDefender, post: this.flags.post, ...extra };
    const scorer = extra.scorer;
    if (kind === 'goal') {
      this.ev.onBanner?.(this.cfg.mode === 'penaltyDefend' ? 'Gol...' : 'GOOOL!', this.cfg.mode === 'penaltyDefend' ? 'bad' : 'good');
      Audio.play('goal');
      Audio.jingle(this.cfg.mode === 'penaltyDefend' ? 'ohno' : 'goal');
      Audio.crowdLevel(0.45);
      setTimeout(() => Audio.crowdLevel(0.12), 4000);
      this.engine.stadium.setExcitement(1);
      setTimeout(() => this.engine.stadium.setExcitement(0), 4500);
      this.engine.stadium.fireworksAt(new Vector3(GOAL.x - 2, 6, 0));
      setTimeout(() => this.engine.stadium.fireworksAt(new Vector3(GOAL.x - 6, 9, -8), ['#ffffff', '#ffd700']), 500);
      setTimeout(() => this.engine.stadium.fireworksAt(new Vector3(GOAL.x - 6, 9, 8)), 900);
      this.engine.director.addShake(0.25);
      if (this.cfg.mode === 'penaltyDefend') {
        // gol dell'avversario: delusione leggera
        this.keeper?.play('sad', { force: true });
      } else {
        const s = scorer ?? this.attackers[0];
        s.target = new Vector3(Math.min(GOAL.x - 8, s.pos.x + 4), 0, s.pos.z * 0.6 + (s.pos.z >= 0 ? 4 : -4));
        setTimeout(() => s.play(Math.random() < 0.5 ? 'kneeSlide' : 'celebrate', { force: true }), 1300);
        setTimeout(() => { s.locked = true; }, 1350);
        this.attackers.forEach((a) => { if (a !== s) { a.target = s.pos.clone().add(new Vector3(-1.2, 0, a.id % 2 ? 1.2 : -1.2)); setTimeout(() => a.play('hug', { force: true }), 1600); } });
        this.defenders.forEach((d) => setTimeout(() => d.play('sad', { force: true }), 600));
        this.engine.director.set('celebrate', s.pos.clone());
        const follow = setInterval(() => this.engine.director.focus.copy(s.pos), 100);
        setTimeout(() => clearInterval(follow), 5000);
      }
    } else if (kind === 'saved') {
      Audio.play('save');
      // parata: musica eroica se para Andrea, "peccato" simpatico se para l'avversario
      Audio.jingle(this.cfg.mode === 'penaltyDefend' ? 'save' : 'ohno');
      if (this.cfg.mode === 'penaltyDefend') { this.keeper?.play('celebrate', { force: true }); Audio.play('cheer'); }
      else this.attackers.forEach((a) => setTimeout(() => a.play('sad', { force: true }), 500));
    } else {
      Audio.play('ooh');
      this.attackers.forEach((a) => setTimeout(() => a.play('sad', { force: true }), 400));
    }
    setTimeout(() => this.ev.onOutcome?.(o), kind === 'goal' ? 3200 : 1800);
  }

  // ---------------- Rigori in difesa: Andrea fa il portiere ----------------
  private setupPenaltyDefend() {
    // il tiratore avversario guarda la porta; il portiere è di Andrea
  }

  /** Rigore avversario: Andrea sceglie dove tuffarsi (-1 sinistra, 0 centro, 1 destra dal punto di vista del portiere) */
  defendPenalty(side: -1 | 0 | 1) {
    if (this.cfg.mode !== 'penaltyDefend' || this.state !== 'aim' || !this.carrier) return;
    const r = Math.random;
    const zs = [-2.6, 0, 2.6];
    const tz = zs[Math.floor(r() * 3)] + (r() - 0.5) * 0.6;
    const ty = 0.3 + r() * 1.6;
    const c = this.carrier;
    const plan = planKick({
      ballPos: this.ball.pos.clone(), path: [this.ball.pos.clone(), new Vector3(GOAL.x, 0, tz)], goalPoint: new Vector3(GOAL.x, ty, tz),
      teammates: [], opponents: [], keeperPos: null, assist: 0.5, gestureSpeed: 1500, canShoot: true
    })!;
    this.aiPenaltyPlan = plan;
    // il portiere guarda verso -X: la sinistra del portiere è +Z
    if (this.keeperAI) this.keeperAI.forcedSide = (side === 0 ? 0 : (side === -1 ? 1 : -1)) as -1 | 0 | 1;
    if (this.keeperAI) this.keeperAI.forcedSaveChance = 0.9 - this.cfg.difficulty * 0.35;
    this.kick(c, plan);
  }

  update(dt: number, time: number) {
    if (this.state === 'idle') return;
    this.stateT += dt;
    if (this.state === 'intro' && this.stateT > 0.6) this.setState('aim');

    // giocatori
    for (const p of this.attackers) p.update(dt, time);
    for (const p of this.defenders) p.update(dt, time);
    if (this.keeper) { this.keeperAI!.update(dt); this.keeper.update(dt, time); }

    // pallone tenuto dal portatore
    if (this.carrier && this.ball.mode === 'held' && (this.state === 'aim' || this.state === 'intro')) {
      if (this.airborne) this.ball.pos.copy(this.carrier.headPoint()).add(new Vector3(0.25, 0.15, 0));
      else this.ball.pos.copy(this.carrier.footPoint());
    }

    if (this.state === 'flight') this.updateFlight(dt);
    if (this.state === 'outcome' && this.ball.mode !== 'held') this.ball.update(dt);

    if (this.trail) {
      this.trailT += dt;
      (this.trail.material as MeshBasicMaterial).opacity = Math.max(0, 0.85 - this.trailT * 0.6);
      if (this.trailT > 1.6) this.removeTrail();
    }
    if (this.targets) this.targets.children.forEach((m, i) => (m.rotation.x = time * (1 + i * 0.3)));
    this.ballMesh.update(this.ball.pos, this.ball.spinAxis, this.ball.spinRate, dt);
  }

  private updateFlight(dt: number) {
    const events = this.ball.update(dt);
    this.handleBallEvents(events);
    if (this.state !== 'flight') return;
    const b = this.ball.pos;
    this.engine.director.focus.copy(b);
    this.engine.stadium.focus(b);

    // portiere: parata
    if (this.keeperAI?.checkSave(b) && !this.ball.goalScored) {
      const k = this.keeperAI;
      if (k.catches) {
        this.ball.hold(k.handsPoint());
        this.ev.onBanner?.(this.cfg.mode === 'penaltyDefend' ? 'PARATA DI ANDREA!' : 'PARATA!', this.cfg.mode === 'penaltyDefend' ? 'good' : 'bad');
      } else {
        const v = this.ball.vel.clone();
        const side = Math.sign(b.z) || 1;
        this.ball.release(new Vector3(-Math.abs(v.x) * 0.25, Math.abs(v.y) * 0.3 + 3, side * (3 + Math.random() * 3)));
        this.ev.onBanner?.(this.cfg.mode === 'penaltyDefend' ? 'PARATA DI ANDREA!' : 'Che parata!', this.cfg.mode === 'penaltyDefend' ? 'good' : 'bad');
      }
      k.willSave = false;
      this.endWith('saved');
      return;
    }

    // difensori: intercetto
    for (let i = 0; i < this.defAI.length; i++) {
      const ai = this.defAI[i];
      if ((ai.willIntercept || this.loose) && ai.canTouch(b) && !(this.loose && this.attackerNear(b) && Math.random() < 0.7)) {
        const d = this.defenders[i];
        d.play(b.y > 0.8 ? 'header' : 'tackle', { force: true });
        this.ball.hold(d.footPoint());
        this.ball.mode = 'held';
        this.ev.onBanner?.('Palla intercettata!', 'bad');
        this.endWith('intercepted');
        return;
      }
    }

    // difensori scavalcati: provano a saltare di testa (e mancano il pallone)
    for (const d of this.defenders) {
      const dh = Math.hypot(b.x - d.pos.x, b.z - d.pos.z);
      if (dh < 2.2 && b.y > 1.4 && b.y < 4 && !d.anim.isBusy) { d.locked = false; d.play('jump', { force: true }); }
    }

    // compagno che riceve
    for (const a of this.attackers) {
      if (a === this.kickerOf() && (this.ball.mode === 'planned' || this.engine.time - this.kickTime < 0.8)) continue;
      const dh = Math.hypot(b.x - a.pos.x, b.z - a.pos.z);
      const near = dh < 1.6 + this.cfg.assist * 0.5;
      if (!near) continue;
      if (b.y < 1.1) { this.receive(a); return; }
      if (b.y < 2.5 && this.ball.vel.y < 0 && b.x > GOAL.x - 22 && this.plan?.type === 'cross') { this.headerChance(a); return; }
    }

    // pallone libero: il compagno più vicino lo insegue
    if (this.ball.mode === 'free') {
      this.loose = true;
      this.looseT += dt;
      const nearestAtt = this.nearest(this.attackers, b);
      if (nearestAtt) { nearestAtt.target = b.clone().setY(0); nearestAtt.maxSpeed = 7.5; }
      if (this.defAI.length) {
        const nd = this.nearestIdx(this.defenders, b);
        if (nd >= 0) this.defAI[nd].chase(b, 0.75);
      }
      if (this.looseT > 6 || this.ball.outOfPlay) this.endWith(this.ball.outOfPlay ? 'miss' : 'lost');
    }
    // tiro finito fuori / troppo debole
    if (this.plan?.isShot && this.ball.mode === 'free' && !this.ball.goalScored) {
      if (b.x > GOAL.x + 0.3 || (this.ball.stopped && b.x > GOAL.x - 6)) this.endWith('miss');
    }
  }

  private kickerOf(): Player | null {
    return this.kickers[this.kickers.length - 1] ?? null;
  }

  private attackerNear(b: Vector3) {
    return this.attackers.some((a) => Math.hypot(b.x - a.pos.x, b.z - a.pos.z) < 1.2);
  }

  private nearest(ps: Player[], b: Vector3): Player | null {
    let best: Player | null = null, bd = Infinity;
    for (const p of ps) { const d = Math.hypot(b.x - p.pos.x, b.z - p.pos.z); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  private nearestIdx(ps: Player[], b: Vector3) {
    let bi = -1, bd = Infinity;
    ps.forEach((p, i) => { const d = Math.hypot(b.x - p.pos.x, b.z - p.pos.z); if (d < bd) { bd = d; bi = i; } });
    return bi;
  }

  private receive(a: Player) {
    const wasLoose = this.loose && !this.plan;
    this.loose = false;
    this.looseT = 0;
    if (this.plan && !wasLoose) {
      this.passes++;
      if (this.plan.beatsDefender) this.flags.beatDefender = true;
      this.ev.onPass?.(this.passes, this.plan.beatsDefender);
      Audio.play('pass');
      this.ev.onBanner?.(['Bel passaggio!', 'Bravo!', 'Ottimo!', 'Perfetto!'][this.passes % 4], 'good');
    } else this.ev.onBanner?.('Palla tua! Ora tira!', 'good');
    this.plan = null;
    this.kickers = [];
    a.target = null;
    a.vel.set(0, 0, 0);
    this.giveBall(a);
    this.kickers.push(a);
    // i difensori si avvicinano un po' al nuovo portatore (senza essere aggressivi)
    this.defAI.forEach((d) => {
      const toward = a.pos.clone().sub(d.home).multiplyScalar(0.25);
      d.setHome(d.home.x + toward.x, d.home.z + toward.z);
    });
    this.enterAim();
  }

  private headerChance(a: Player) {
    this.plan = null;
    this.loose = false;
    a.target = null;
    a.vel.set(0, 0, 0);
    a.play('lookUp', { force: true });
    this.carrier = a;
    this.airborne = true;
    this.ball.hold(a.headPoint());
    this.passes++;
    this.ev.onPass?.(this.passes, false);
    this.kickers = [a];
    this.ev.onBanner?.('COLPO DI TESTA! Disegna il tiro!', 'info');
    this.enterAim();
  }

  private handleBallEvents(events: BallEvent[]) {
    for (const e of events) {
      switch (e.type) {
        case 'bounce': Audio.play('bounce', e.speed); break;
        case 'post':
          Audio.play('post');
          this.flags.post = true;
          this.engine.director.addShake(0.15);
          this.ev.onBanner?.('PALO!', 'info');
          break;
        case 'net': Audio.play('net'); this.engine.stadium.goal.hit(e.point.y, e.point.z, e.speed); break;
        case 'goal': {
          const corner = Math.abs(e.point.z) > GOAL.halfWidth - 1.3 || e.point.y > 1.75;
          let targetHit: number | undefined;
          this.cfg.targets?.forEach((t, i) => {
            if (Math.hypot(e.point.y - t.y, e.point.z - t.z) < t.r + 0.15) targetHit = i;
          });
          const scorer = this.kickerOf() ?? this.attackers[0];
          this.engine.stadium.goal.hit(e.point.y, e.point.z, this.ball.vel.length());
          this.endWith('goal', { corner, goalPoint: e.point, targetHit, scorer });
          return;
        }
        case 'out':
          if (!this.ball.goalScored) this.endWith('miss');
          return;
        case 'arrived':
          if (this.plan && !this.plan.isShot && this.receiver) {
            // passaggio nello spazio: il compagno continua a correre verso il pallone
            this.receiver.target = this.ball.pos.clone().setY(0);
          }
          break;
        case 'stopped': break;
      }
    }
  }


  /** Proiezioni per i suggerimenti a schermo */
  hintPoints(): { from: Vector3; to: Vector3 } | null {
    if (!this.carrier) return null;
    const sc = this.cfg.scenario;
    const from = this.ball.pos.clone();
    if (sc.highlight !== undefined && this.passes === 0 && this.attackers[sc.highlight] && this.attackers[sc.highlight] !== this.carrier) {
      return { from, to: this.attackers[sc.highlight].pos.clone().setY(0) };
    }
    const kz = this.keeper ? (this.keeper.pos.z > 0 ? -2.2 : 2.2) : 0;
    return { from, to: new Vector3(GOAL.x, 0.8, kz) };
  }

  dispose() {
    this.clearPreview();
    this.unsub();
    this.clearPlayers();
    this.removeTrail();
    this.engine.scene.remove(this.ballMesh.group);
    this.setState('idle');
  }
}
