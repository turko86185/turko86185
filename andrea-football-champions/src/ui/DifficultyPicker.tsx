import { useState } from 'react';
import { Save, type Difficulty } from '../game/save/SaveManager';
import { Audio } from '../game/audio/AudioManager';

const OPTS: { id: Difficulty; label: string; icon: string; cls: string; say: string }[] = [
  { id: 'facile', label: 'FACILE', icon: '😊', cls: 'green', say: 'Facile! Segnerai tantissimi gol!' },
  { id: 'medio', label: 'MEDIO', icon: '💪', cls: 'orange', say: 'Medio! Una bella sfida!' },
  { id: 'difficile', label: 'DIFFICILE', icon: '🔥', cls: 'red', say: 'Difficile! Solo per veri campioni!' }
];

/** Scelta della difficoltà: Facile, Medio, Difficile */
export function DifficultyPicker({ big }: { big?: boolean }) {
  const [cur, setCur] = useState<Difficulty>(Save.data.settings.difficulty ?? 'facile');
  return (
    <div className="diff" data-testid="difficulty">
      {big && <div className="diff-title">Difficoltà</div>}
      <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
        {OPTS.map((o) => (
          <button key={o.id} data-testid={`diff-${o.id}`} className={`btn small ${cur === o.id ? o.cls : ''} ${cur === o.id ? 'diff-on' : 'diff-off'}`}
            onClick={() => { Audio.play('click'); Save.update((d) => { d.settings.difficulty = o.id; }); setCur(o.id); Audio.say(o.say); }}>
            {o.icon} {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
