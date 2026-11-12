import { useEffect, useState } from 'react';
import { Mascot } from '../Mascot';
import { Badge } from '../Badge';
import { getTeam } from '../../game/teams/teams';
import { Save } from '../../game/save/SaveManager';
import { Audio } from '../../game/audio/AudioManager';
import { DifficultyPicker } from '../DifficultyPicker';

const GREETINGS = ['Bentornato Andrea! Pronto per un altro gol?', 'Ciao campione! Si gioca?', 'Eccoti Andrea! Lo stadio ti aspetta!', 'Bravo Andrea! Facciamo un\'altra partita?'];

export type MenuTarget = 'play' | 'levels' | 'quick' | 'championship' | 'penalties' | 'training' | 'team' | 'trophies' | 'settings';

export function Menu({ go, greet }: { go: (t: MenuTarget) => void; greet: boolean }) {
  const [msg] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
  useEffect(() => {
    Audio.startMusic();
    if (greet) Audio.say(msg);
  }, []);
  const team = Save.data.teamId ? getTeam(Save.data.teamId) : null;
  const stars = Save.totalStars;
  const b = (t: MenuTarget, cls: string, ic: string, label: string) => (
    <button className={`btn ${cls}`} onClick={() => { Audio.play('click'); go(t); }} data-testid={`menu-${t}`}><span className="ic">{ic}</span>{label}</button>
  );
  return (
    <div className="screen dim" data-testid="menu">
      <div className="topbar">
        <span className="pill">⭐ {stars}</span>
        <h1 style={{ fontSize: 'clamp(22px, 6vw, 40px)', color: 'var(--yellow)' }}>ANDREA FOOTBALL CHAMPIONS</h1>
        <button className="btn icon" onClick={() => go('settings')} aria-label="Impostazioni">⚙️</button>
      </div>
      {greet && (
        <div className="row" style={{ margin: '4px 0' }}>
          <Mascot size={80} />
          <div className="speech" style={{ fontSize: 18 }}>{msg}</div>
        </div>
      )}
      {team && <div className="row" style={{ gap: 8 }}><Badge team={team} size={34} /><b>{team.name}</b></div>}
      <DifficultyPicker />
      <div className="menu-grid">
        {b('play', 'yellow play big', '▶️', 'GIOCA')}
        {b('levels', 'green', '🗺️', 'LIVELLI')}
        {b('quick', '', '⚡', 'PARTITA VELOCE')}
        {b('championship', 'orange', '🏟️', 'CAMPIONATO')}
        {b('penalties', 'purple', '🥅', 'RIGORI')}
        {b('training', 'green', '🎯', 'ALLENAMENTO')}
        {b('team', '', '👕', 'SCEGLI SQUADRA')}
        {b('trophies', 'yellow', '🏆', 'TROFEI')}
      </div>
    </div>
  );
}
