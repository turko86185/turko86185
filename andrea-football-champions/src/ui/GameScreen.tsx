import { useEffect, useRef, useState } from 'react';
import type { Engine } from '../game/engine/Engine';
import { Match, type Outcome } from '../game/match/Match';
import { InputDrawer } from '../game/trajectory/InputDrawer';
import { applyDifficulty, type Session, type SessionResult } from '../game/match/sessions';
import { Audio } from '../game/audio/AudioManager';
import { Save } from '../game/save/SaveManager';
import { BALLS } from '../game/save/rewards';

export interface GameEnd { result: SessionResult; session: Session }

/** Schermata di gioco: campo 3D, disegno con il dito, HUD, messaggi */
export function GameScreen({ engine, session, onEnd, onQuit }: { engine: Engine; session: Session; onEnd: (e: GameEnd) => void; onQuit: () => void }) {
  const drawRef = useRef<HTMLCanvasElement>(null);
  const matchRef = useRef<Match | null>(null);
  const [hud, setHud] = useState(session.hud());
  const [banner, setBanner] = useState<{ text: string; kind: string; id: number } | null>(null);
  const [interlude, setInterlude] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [state, setState] = useState('intro');
  const [hand, setHand] = useState<{ x: number; y: number } | null>(null);
  const [hintOn, setHintOn] = useState(false);
  const endedRef = useRef(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  useEffect(() => {
    const ball = BALLS.find((b) => b.id === Save.data.ballId) ?? BALLS[0];
    let bannerTimer = 0;
    const showBanner = (text: string, kind = 'info') => {
      setBanner({ text, kind, id: Math.random() });
      clearTimeout(bannerTimer);
      bannerTimer = window.setTimeout(() => setBanner(null), 1600);
    };
    const finish = (r: SessionResult) => {
      if (endedRef.current) return;
      endedRef.current = true;
      setTimeout(() => onEnd({ result: r, session }), r.interlude ? 2600 : 900);
      if (r.interlude) setInterlude(r.interlude);
    };
    const m = new Match(engine, ball, {
      onState: (s) => setState(s),
      onBanner: (t, k) => showBanner(t, k),
      onPass: (count, beat) => {
        Save.update((d) => { d.records.passes++; });
        Save.award('primo-passaggio');
        const r = session.onPass?.(count, beat);
        setHud(session.hud());
        if (r?.done) { showBanner(r.title ?? 'BRAVO!', 'good'); Audio.say(r.title ?? 'Bravo!'); finish(r); }
        else if (r?.interlude) setInterlude(r.interlude);
      },
      onOutcome: (o: Outcome) => {
        if (endedRef.current) return;
        recordStats(o, session);
        const r = session.onOutcome(o);
        setHud(session.hud());
        if (r.done) { finish(r); return; }
        if (r.interlude) setInterlude(r.interlude);
        setTimeout(() => {
          if (endedRef.current) return;
          setInterlude(null);
          m.setup(applyDifficulty(session.nextConfig(), Save.data.settings.difficulty));
          setHintOn(!!m.cfg.hint);
        }, 2400);
      }
    });
    matchRef.current = m;
    const cfg = applyDifficulty(session.nextConfig(), Save.data.settings.difficulty);
    m.setup(cfg);
    setHintOn(!!cfg.hint);
    const drawer = new InputDrawer(drawRef.current!, engine);
    drawer.enabled = () => !pausedRef.current && m.canDraw;
    drawer.onStart = () => setHand(null);
    drawer.onDone = (res) => {
      if (!m.canDraw) return;
      const plan = m.submitPath(res.path, res.goalPoint, res.gestureSpeed);
      (window as any).__afc.lastPlan = plan;
      if (plan) setHintOn(false);
    };
    Audio.startCrowd();
    Audio.stopMusic();
    (window as any).__afc = { match: m, engine, drawer, session };
    return () => {
      clearTimeout(bannerTimer);
      drawer.dispose();
      m.dispose();
      Audio.stopCrowd();
      engine.director.set('menu');
      matchRef.current = null;
    };
  }, []);

  // GOL → voce italiana
  useEffect(() => {
    if (!banner) return;
    if (banner.kind === 'good' && banner.text.includes('PARATA')) Audio.say('Che parata Andrea!');
    if (banner.text === 'GOOOL!') {
      const phrases = ['Gol! Bravissimo Andrea!', 'Che gol incredibile!', 'Sei un campione!', 'Gol! Fantastico!'];
      Audio.say(phrases[Math.floor(Math.random() * phrases.length)]);
    }
  }, [banner]);

  // manina che suggerisce il gesto
  useEffect(() => {
    if (!hintOn || state !== 'aim') { setHand(null); return; }
    let raf = 0;
    const t0 = performance.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const m = matchRef.current;
      const hp = m?.hintPoints();
      if (!m || !hp) return;
      const a = engine.worldToScreen(hp.from), b = engine.worldToScreen(hp.to);
      const u = ((performance.now() - t0) / 1400) % 1.3;
      const k = Math.min(1, u);
      const e = k * k * (3 - 2 * k);
      setHand({ x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e });
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [hintOn, state]);

  const isPenaltyDefend = session.kind === 'penalties' && matchRef.current?.cfg?.mode === 'penaltyDefend';

  return (
    <>
      <canvas ref={drawRef} className="draw" data-testid="draw-canvas" />
      <div className="hud">
        <div className="row" style={{ gap: 6 }}>
          <button className="btn icon" aria-label="Pausa" onClick={() => { Audio.play('click'); setPaused(true); }}>⏸</button>
          {hud.left && <span className="score" style={{ fontSize: 16 }}>{hud.left}</span>}
        </div>
        <div className="objective" data-testid="objective">
          {hud.objective}
          {hud.progress && <small>{hud.progress}</small>}
        </div>
        <div>
          {hud.scoreHome !== undefined ? (
            <span className="score" data-testid="score">{hud.homeShort} {hud.scoreHome} - {hud.scoreAway} {hud.awayShort}</span>
          ) : hud.right ? <span className="score" style={{ fontSize: 16 }}>{hud.right}</span> : null}
        </div>
      </div>
      {banner && <div key={banner.id} className={`banner ${banner.kind}`} data-testid="banner">{banner.text}</div>}
      {interlude && <div className="interlude" data-testid="interlude">{interlude}</div>}
      {hand && <div className="hand" style={{ left: hand.x, top: hand.y }}>👆</div>}
      {state === 'aim' && !hintOn && !interlude && !isPenaltyDefend && (
        <div className="interlude" style={{ opacity: 0.85, fontSize: 16 }}>✍️ Disegna con il dito dove deve andare il pallone!</div>
      )}
      {isPenaltyDefend && state === 'aim' && (
        <div className="keeper-btns">
          <button className="btn purple" onClick={() => matchRef.current?.defendPenalty(-1)}>⬅️<br />Sinistra</button>
          <button className="btn purple" onClick={() => matchRef.current?.defendPenalty(0)}>⬆️<br />Centro</button>
          <button className="btn purple" onClick={() => matchRef.current?.defendPenalty(1)}>➡️<br />Destra</button>
        </div>
      )}
      {paused && (
        <div className="result" style={{ zIndex: 40 }}>
          <h2 style={{ fontSize: 40 }}>Pausa</h2>
          <div className="row">
            <button className="btn green big" onClick={() => setPaused(false)}>▶️ CONTINUA</button>
          </div>
          <button className="btn red" onClick={() => { endedRef.current = true; onQuit(); }}>🏠 Torna al menu</button>
        </div>
      )}
    </>
  );
}

function recordStats(o: Outcome, session: Session) {
  const defending = session.kind === 'penalties' && (session as any).turn === 'save';
  if (o.post) Save.award('palo');
  if (o.kind !== 'goal' || defending) return;
  Save.update((d) => {
    d.records.goals++;
    if (o.curve) d.records.curlGoals++;
    if (o.header) d.records.headerGoals++;
    if (o.corner) d.records.cornerGoals++;
    if (o.long) d.records.longGoals++;
    if (session.kind === 'penalties') d.records.penaltiesScored++;
  });
  const r = Save.data.records;
  Save.award('primo-gol');
  if (r.goals >= 10) Save.award('gol-10');
  if (r.goals >= 50) Save.award('gol-50');
  if (r.goals >= 100) Save.award('gol-100');
  if (o.curve) Save.award('effetto');
  if (o.header) Save.award('testa');
  if (o.corner) Save.award('angolino');
}
