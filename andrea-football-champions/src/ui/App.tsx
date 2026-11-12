import { useEffect, useRef, useState } from 'react';
import { Engine } from '../game/engine/Engine';
import { Save } from '../game/save/SaveManager';
import { Audio } from '../game/audio/AudioManager';
import { getLevel, LEVELS } from '../game/levels/levels';
import { LevelSession, QuickMatchSession, PenaltySession, TrainingSession, newChampionship, recordRound, standings, type Session, type Drill, CHAMP_ROUNDS } from '../game/match/sessions';
import { getTeam } from '../game/teams/teams';
import { GameScreen, type GameEnd } from './GameScreen';
import { Splash, Welcome } from './screens/Intro';
import { Menu, type MenuTarget } from './screens/Menu';
import { TeamSelect } from './screens/TeamSelect';
import { LevelSelect, OpponentSelect, TrainingSelect, Trophies, ChampionshipScreen, Settings } from './screens/Lists';

type Screen =
  | { s: 'splash' } | { s: 'welcome' } | { s: 'menu'; greet: boolean } | { s: 'team'; first?: boolean } | { s: 'levels' }
  | { s: 'quick' } | { s: 'penalties' } | { s: 'training' } | { s: 'trophies' } | { s: 'championship' } | { s: 'settings' }
  | { s: 'game'; session: Session } | { s: 'result'; end: GameEnd } | { s: 'ceremony' };

export function App() {
  const glRef = useRef<HTMLCanvasElement>(null);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [screen, setScreen] = useState<Screen>({ s: 'splash' });
  const [, force] = useState(0);

  useEffect(() => {
    const e = new Engine(glRef.current!, Save.data.stadiumId, Save.data.settings.quality);
    e.director.set('menu');
    e.director.snap();
    setEngine(e);
    Audio.setSettings(Save.data.settings);
    return () => e.dispose();
  }, []);

  const startGame = (session: Session) => {
    if (!engine) return;
    engine.setStadium(Save.data.stadiumId);
    Audio.stopMusic();
    setScreen({ s: 'game', session });
  };
  const playLevel = (id: number) => startGame(new LevelSession(getLevel(id), Save.data.teamId!, Save.data.kitId));
  const nextLevelId = () => (LEVELS.find((l) => !Save.data.levels[l.id]) ?? LEVELS[LEVELS.length - 1]).id;

  const go = (t: MenuTarget) => {
    if (!Save.data.teamId && t !== 'settings' && t !== 'trophies') { setScreen({ s: 'team', first: true }); return; }
    switch (t) {
      case 'play': playLevel(nextLevelId()); break;
      case 'levels': setScreen({ s: 'levels' }); break;
      case 'quick': setScreen({ s: 'quick' }); break;
      case 'penalties': setScreen({ s: 'penalties' }); break;
      case 'training': setScreen({ s: 'training' }); break;
      case 'trophies': setScreen({ s: 'trophies' }); break;
      case 'championship': setScreen({ s: 'championship' }); break;
      case 'team': setScreen({ s: 'team' }); break;
      case 'settings': setScreen({ s: 'settings' }); break;
    }
  };

  const onGameEnd = (end: GameEnd) => {
    const { session, result } = end;
    if (session instanceof LevelSession && result.success) {
      Save.completeLevel(session.level.id, result.stars ?? 1);
      const ch = session.level.chapter;
      const chLevels = LEVELS.filter((l) => l.chapter === ch);
      if (chLevels.every((l) => Save.data.levels[l.id])) Save.award(`capitolo-${ch}`);
      if (session.level.stage === 'finale') Save.award('coppa-livelli');
    }
    if (session instanceof QuickMatchSession) {
      if (session.kind === 'championship') {
        const st = Save.data.championship;
        if (st) {
          recordRound(st, session.gf, session.ga);
          if (st.finished && standings(st)[0].id === st.teamId) { Save.award('coppa-campionato'); Save.data.records.championships++; }
          Save.save();
        }
      } else {
        Save.update((d) => { d.records.quickPlayed++; if (session.gf > session.ga) d.records.quickWins++; });
        if (session.gf > session.ga) Save.award('vittoria-veloce');
      }
    }
    if (session instanceof PenaltySession && result.success) { Save.update((d) => { d.records.penaltyWins++; }); Save.award('coppa-rigori'); }
    if (Save.totalStars >= 100) Save.award('stelle-100');
    if (result.title) Audio.say(result.title.replace('!', '').toLowerCase());
    if (session instanceof LevelSession && session.level.stage === 'finale' && result.success) { setScreen({ s: 'ceremony' }); return; }
    setScreen({ s: 'result', end });
  };

  const quitTraining = (session: Session) => {
    if (session instanceof TrainingSession) {
      const pts = session.points;
      Save.update((d) => { d.records.trainingBest = Math.max(d.records.trainingBest, pts); });
      if (pts >= 10) Save.award('allenamento');
    }
    engine?.director.set('menu');
    setScreen({ s: 'menu', greet: true });
  };

  const s = screen;
  return (
    <>
      <canvas ref={glRef} className="gl" />
      {s.s === 'splash' && <Splash onStart={() => { Audio.unlock(); Audio.play('click'); setScreen(Save.data.welcomed ? { s: 'menu', greet: true } : { s: 'welcome' }); }} />}
      {s.s === 'welcome' && <Welcome onPlay={() => { Save.update((d) => { d.welcomed = true; }); setScreen(Save.data.teamId ? { s: 'menu', greet: false } : { s: 'team', first: true }); }} />}
      {s.s === 'menu' && <Menu go={go} greet={s.greet} />}
      {s.s === 'team' && <TeamSelect first={s.first} onBack={() => setScreen({ s: 'menu', greet: false })} onDone={() => { Audio.say(`Grande scelta! Forza ${getTeam(Save.data.teamId!).name}!`); setScreen({ s: 'menu', greet: false }); }} onStadium={(id) => engine?.setStadium(id)} />}
      {s.s === 'levels' && <LevelSelect onBack={() => setScreen({ s: 'menu', greet: false })} onPick={playLevel} />}
      {s.s === 'quick' && <OpponentSelect title="Partita Veloce" onBack={() => setScreen({ s: 'menu', greet: false })} onPick={(opp) => startGame(new QuickMatchSession(Save.data.teamId!, opp, Save.data.kitId, 5, 0.3))} />}
      {s.s === 'penalties' && <OpponentSelect title="Calci di Rigore" onBack={() => setScreen({ s: 'menu', greet: false })} onPick={(opp) => startGame(new PenaltySession(Save.data.teamId!, opp, Save.data.kitId))} />}
      {s.s === 'training' && <TrainingSelect onBack={() => setScreen({ s: 'menu', greet: false })} onPick={(d: Drill) => startGame(new TrainingSession(Save.data.teamId!, Save.data.kitId, d))} />}
      {s.s === 'trophies' && <Trophies onBack={() => setScreen({ s: 'menu', greet: false })} />}
      {s.s === 'settings' && <Settings onBack={() => setScreen({ s: 'menu', greet: false })} onChange={() => force((x) => x + 1)} />}
      {s.s === 'championship' && (
        <ChampionshipScreen
          onBack={() => setScreen({ s: 'menu', greet: false })}
          onNew={() => { Save.update((d) => { d.championship = newChampionship(d.teamId!); }); force((x) => x + 1); }}
          onPlay={() => {
            const st = Save.data.championship!;
            const q = new QuickMatchSession(st.teamId, st.opponents[st.round], Save.data.kitId, 3, 0.25 + (st.round / CHAMP_ROUNDS) * 0.3);
            q.kind = 'championship';
            startGame(q);
          }}
        />
      )}
      {s.s === 'game' && engine && (
        <GameScreen engine={engine} session={s.session} onEnd={onGameEnd} onQuit={() => quitTraining(s.session)} />
      )}
      {s.s === 'result' && <ResultView end={s.end} onMenu={() => setScreen({ s: 'menu', greet: true })}
        onRetry={() => { const se = s.end.session; if (se instanceof LevelSession) playLevel(se.level.id); else if (se.kind === 'championship') setScreen({ s: 'championship' }); else if (se instanceof QuickMatchSession) startGame(new QuickMatchSession(Save.data.teamId!, se.awayTeam.id, Save.data.kitId, 5, 0.3)); else if (se instanceof PenaltySession) startGame(new PenaltySession(Save.data.teamId!, se.awayTeam.id, Save.data.kitId)); }}
        onNext={() => { const se = s.end.session; if (se instanceof LevelSession) playLevel(Math.min(100, se.level.id + 1)); }} />}
      {s.s === 'ceremony' && <Ceremony onDone={() => setScreen({ s: 'menu', greet: true })} />}
    </>
  );
}

function ResultView({ end, onMenu, onRetry, onNext }: { end: GameEnd; onMenu: () => void; onRetry: () => void; onNext: () => void }) {
  const { result, session } = end;
  const isLevel = session instanceof LevelSession;
  useEffect(() => { Audio.play(result.success ? 'star' : 'click'); if (result.success) { Audio.play('applause'); Audio.jingle('win'); } }, []);
  return (
    <div className="result" data-testid="result">
      {result.success && <Confetti />}
      <h1 style={{ fontSize: 'clamp(32px, 9vw, 64px)', color: 'var(--yellow)' }}>{result.title}</h1>
      {result.subtitle && <p className="subtitle">{result.subtitle}</p>}
      {isLevel && result.success && (
        <div className="stars">{[1, 2, 3].map((i) => <span key={i} className={i <= (result.stars ?? 0) ? '' : 'off'} style={{ animationDelay: `${i * 0.25}s` }}>⭐</span>)}</div>
      )}
      {!isLevel && <div className="cup" style={{ fontSize: 90 }}>{result.success ? '🏆' : '⚽'}</div>}
      <div className="row">
        {isLevel && result.success && (session as LevelSession).level.id < 100 && <button className="btn green big" onClick={onNext} data-testid="btn-next">AVANTI ▶</button>}
        <button className="btn yellow" onClick={onRetry} data-testid="btn-retry">🔁 {session.kind === 'championship' ? 'CLASSIFICA' : 'RIGIOCA'}</button>
        <button className="btn" onClick={onMenu} data-testid="btn-menu">🏠 MENU</button>
      </div>
    </div>
  );
}

function Confetti() {
  const cols = ['#ffd23f', '#ff4d6d', '#3fa9ff', '#2ecc71', '#b388ff'];
  return (
    <div className="confetti">
      {Array.from({ length: 50 }, (_, i) => (
        <i key={i} style={{ left: `${(i * 37) % 100}%`, background: cols[i % 5], animationDuration: `${2 + (i % 5) * 0.6}s`, animationDelay: `${(i % 10) * 0.2}s` }} />
      ))}
    </div>
  );
}

/** Premiazione finale */
function Ceremony({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    Audio.play('goal');
    Audio.jingle('cup');
    Audio.say('Hai vinto la coppa! Andrea sei il campione dei campioni!');
    setTimeout(() => Audio.startMusic(), 7000);
  }, []);
  return (
    <div className="result" data-testid="ceremony">
      <Confetti />
      <h1 className="title-xl" style={{ fontSize: 'clamp(30px, 9vw, 70px)' }}>HAI VINTO LA COPPA!</h1>
      <div className="cup">🏆</div>
      <p className="subtitle">ANDREA, SEI IL CAMPIONE DEI CAMPIONI!</p>
      <div className="stars"><span>🥇</span><span>⭐</span><span>🥇</span></div>
      <button className="btn yellow big" onClick={onDone}>FESTEGGIA! 🎉</button>
    </div>
  );
}
