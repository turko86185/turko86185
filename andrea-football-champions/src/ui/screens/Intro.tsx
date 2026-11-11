import { useEffect, useState } from 'react';
import { Mascot } from '../Mascot';
import { Audio } from '../../game/audio/AudioManager';

export const WELCOME_TEXT = 'CIAO ANDREA! SEI PRONTO A DIVENTARE UN GRANDE CAMPIONE? IL TUO STADIO TI ASPETTA! SCEGLI LA TUA SQUADRA E FACCIAMO QUALCHE GOL!';

/** Primo tocco: necessario su iPhone per attivare audio e voce */
export function Splash({ onStart }: { onStart: () => void }) {
  return (
    <div className="screen center dim" onPointerUp={onStart} data-testid="splash">
      <div className="ball-bounce">⚽</div>
      <div className="title-xl" style={{ fontSize: 'clamp(30px, 9vw, 70px)' }}>ANDREA</div>
      <h2 style={{ fontSize: 'clamp(20px, 5vw, 36px)' }}>FOOTBALL CHAMPIONS</h2>
      <p className="subtitle" style={{ marginTop: 30, animation: 'pulse 1.2s infinite' }}>👆 TOCCA PER INIZIARE</p>
    </div>
  );
}

/** Schermata cinematografica di benvenuto */
export function Welcome({ onPlay }: { onPlay: () => void }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    Audio.startMusic();
    const t = setTimeout(() => Audio.say('Ciao Andrea! Sei pronto a diventare un grande campione? Il tuo stadio ti aspetta! Scegli la tua squadra e facciamo qualche gol!', { rate: 0.95, pitch: 1.3 }), 600);
    const iv = setInterval(() => setShown((s) => Math.min(WELCOME_TEXT.length, s + 2)), 40);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, []);
  return (
    <div className="screen center" style={{ background: 'radial-gradient(circle at 50% 30%, rgba(255,240,180,0.25), rgba(5,20,45,0.55) 70%)', gap: 10 }} data-testid="welcome">
      <div className="title-xl">ANDREA</div>
      <div className="row" style={{ alignItems: 'center', marginTop: 8, flexWrap: 'nowrap' }}>
        <Mascot />
        <div className="speech" style={{ flex: 1 }}>{WELCOME_TEXT.slice(0, shown)}</div>
        <span className="ball-bounce">⚽</span>
      </div>
      <button className="btn yellow big" onClick={() => { Audio.play('whistle'); onPlay(); }} data-testid="btn-giochiamo">GIOCHIAMO! ⚽</button>
    </div>
  );
}
