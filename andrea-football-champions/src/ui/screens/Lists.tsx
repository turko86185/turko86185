import { useState } from 'react';
import { CHAPTERS, LEVELS } from '../../game/levels/levels';
import { Save } from '../../game/save/SaveManager';
import { TEAMS, getTeam } from '../../game/teams/teams';
import { Badge } from '../Badge';
import { TROPHIES, BALLS, KIT_UNLOCKS } from '../../game/save/rewards';
import { STADIUMS } from '../../game/engine/themes';
import { CHAMP_ROUNDS, standings } from '../../game/match/sessions';
import type { Drill } from '../../game/match/sessions';
import { Audio } from '../../game/audio/AudioManager';
import { DifficultyPicker } from '../DifficultyPicker';

const Back = ({ onBack }: { onBack: () => void }) => <button className="btn small red" onClick={() => { Audio.play('click'); onBack(); }}>⬅ Menu</button>;

export function LevelSelect({ onPick, onBack }: { onPick: (id: number) => void; onBack: () => void }) {
  const firstOpen = LEVELS.find((l) => !Save.data.levels[l.id])?.chapter ?? 4;
  const [ch, setCh] = useState<number>(firstOpen);
  const chapter = CHAPTERS.find((c) => c.id === ch)!;
  return (
    <div className="screen dim" data-testid="levels">
      <div className="topbar"><Back onBack={onBack} /><h2>Livelli</h2><span className="pill">⭐ {Save.totalStars}/300</span></div>
      <div className="tabs">
        {CHAPTERS.map((c) => (
          <button key={c.id} className="btn small" style={{ background: ch === c.id ? c.color : undefined }} onClick={() => setCh(c.id)}>{c.icon} {c.id}</button>
        ))}
      </div>
      <h3>Capitolo {chapter.id} – {chapter.name}</h3>
      <div className="level-grid">
        {LEVELS.filter((l) => l.chapter === ch).map((l) => {
          const open = Save.isUnlocked(l.id);
          const st = Save.data.levels[l.id]?.stars ?? 0;
          return (
            <button key={l.id} className={`lvl ${open ? '' : 'locked'}`} style={{ background: chapter.color }} onClick={() => open && onPick(l.id)} data-testid={`level-${l.id}`} title={l.title}>
              {open ? l.id : '🔒'}
              <span className="st">{open ? '⭐'.repeat(st) + '☆'.repeat(3 - st) : ''}</span>
              {l.stage && <span style={{ fontSize: 16 }}>🏆</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function OpponentSelect({ title, onPick, onBack }: { title: string; onPick: (id: string) => void; onBack: () => void }) {
  const mine = Save.data.teamId!;
  const [sel, setSel] = useState<string>(TEAMS.find((t) => t.id !== mine)!.id);
  const me = getTeam(mine);
  return (
    <div className="screen dim">
      <div className="topbar"><Back onBack={onBack} /><h2>{title}</h2><button className="btn small green" onClick={() => onPick(sel)} data-testid="opp-ok">GIOCA ▶</button></div>
      <div className="row card" style={{ margin: '8px 0' }}>
        <Badge team={me} size={50} /><b style={{ fontSize: 26 }}>VS</b><Badge team={getTeam(sel)} size={50} />
      </div>
      <p className="rotate-tip">Scegli la squadra avversaria</p>
      <div className="team-grid">
        {TEAMS.filter((t) => t.id !== mine).map((t) => (
          <button key={t.id} className={`team ${sel === t.id ? 'sel' : ''}`} onClick={() => { Audio.play('click'); setSel(t.id); }}>
            <Badge team={t} size={44} />{t.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TrainingSelect({ onPick, onBack }: { onPick: (d: Drill) => void; onBack: () => void }) {
  return (
    <div className="screen dim center" style={{ gap: 14 }}>
      <div className="topbar"><Back onBack={onBack} /><h2>Allenamento</h2><span className="pill">Record: {Save.data.records.trainingBest}</span></div>
      <button className="btn big yellow" onClick={() => onPick('tiro')} data-testid="drill-tiro">🎯 TIRO AL BERSAGLIO</button>
      <button className="btn big green" onClick={() => onPick('passaggi')}>👟 PASSAGGI</button>
      <button className="btn big purple" onClick={() => onPick('precisione')}>🧤 PRECISIONE CONTRO IL PORTIERE</button>
    </div>
  );
}

export function Trophies({ onBack }: { onBack: () => void }) {
  const d = Save.data;
  const r = d.records;
  const stars = Save.totalStars;
  return (
    <div className="screen dim" data-testid="trophies">
      <div className="topbar"><Back onBack={onBack} /><h2>Trofei</h2><span className="pill">⭐ {stars}</span></div>
      <div className="trophy-grid">
        {TROPHIES.map((t) => {
          const ok = d.trophies.includes(t.id);
          return (
            <div key={t.id} className={`trophy ${ok ? '' : 'off'}`}>
              <div className="ic">{t.icon}</div>
              <b>{t.name}</b>
              <div style={{ fontSize: 13 }}>{t.desc}</div>
              <small>{t.kind.toUpperCase()}</small>
            </div>
          );
        })}
      </div>
      <h3 style={{ marginTop: 14 }}>Record personali</h3>
      <div className="card" style={{ width: 'min(900px,100%)' }}>
        <div className="row" style={{ gap: 18 }}>
          <span>⚽ Gol: <b>{r.goals}</b></span><span>👟 Passaggi: <b>{r.passes}</b></span><span>🌀 Gol a effetto: <b>{r.curlGoals}</b></span>
          <span>🙆 Di testa: <b>{r.headerGoals}</b></span><span>🎯 Angolini: <b>{r.cornerGoals}</b></span><span>🚀 Da fuori: <b>{r.longGoals}</b></span>
          <span>🥅 Rigori segnati: <b>{r.penaltiesScored}</b></span><span>⚡ Vittorie: <b>{r.quickWins}</b>/{r.quickPlayed}</span>
          <span>💪 Allenamento: <b>{r.trainingBest}</b></span><span>🛡️ Campionati vinti: <b>{r.championships}</b></span>
        </div>
      </div>
      <h3 style={{ marginTop: 14 }}>Premi da sbloccare</h3>
      <div className="trophy-grid">
        {BALLS.map((b) => <div key={b.id} className={`trophy ${stars >= b.stars ? '' : 'off'}`}><div className="ic">⚽</div><b>{b.name}</b><div>⭐ {b.stars}</div></div>)}
        {STADIUMS.map((s) => <div key={s.id} className={`trophy ${stars >= s.unlockStars ? '' : 'off'}`}><div className="ic">🏟️</div><b>{s.name}</b><div>⭐ {s.unlockStars}</div></div>)}
        {KIT_UNLOCKS.slice(2).map((k) => <div key={k.id} className={`trophy ${k.check(d, stars) ? '' : 'off'}`}><div className="ic">👕</div><b>{k.name}</b><div style={{ fontSize: 13 }}>{k.requirement}</div></div>)}
      </div>
    </div>
  );
}

export function ChampionshipScreen({ onPlay, onBack, onNew }: { onPlay: () => void; onBack: () => void; onNew: () => void }) {
  const st = Save.data.championship;
  const mine = Save.data.teamId!;
  if (!st || st.teamId !== mine) {
    return (
      <div className="screen dim center" style={{ gap: 14 }}>
        <div className="topbar"><Back onBack={onBack} /><h2>Campionato</h2><span /></div>
        <div className="cup">🏆</div>
        <p className="subtitle">Gioca {CHAMP_ROUNDS} giornate contro tutte le squadre della Serie A e vinci la coppa!</p>
        <button className="btn big yellow" onClick={onNew} data-testid="champ-new">INIZIA IL CAMPIONATO</button>
      </div>
    );
  }
  const table = standings(st);
  const pos = table.findIndex((r) => r.id === mine) + 1;
  const next = st.finished ? null : getTeam(st.opponents[st.round]);
  return (
    <div className="screen dim">
      <div className="topbar"><Back onBack={onBack} /><h2>Campionato</h2><span className="pill">Giornata {Math.min(st.round + 1, CHAMP_ROUNDS)}/{CHAMP_ROUNDS}</span></div>
      {next ? (
        <div className="row card" style={{ margin: '6px 0' }}>
          <Badge team={getTeam(mine)} size={40} /><b>VS</b><Badge team={next} size={40} /><b>{next.name}</b>
          <button className="btn green" onClick={onPlay} data-testid="champ-play">GIOCA ▶</button>
        </div>
      ) : (
        <div className="card row" style={{ margin: 6 }}>
          <b style={{ fontSize: 22 }}>{pos === 1 ? '🏆 CAMPIONE D\'ITALIA!' : pos <= 3 ? `🥇 Sul podio: ${pos}° posto!` : `Hai finito ${pos}°. Bravo!`}</b>
          <button className="btn yellow" onClick={onNew}>NUOVO CAMPIONATO</button>
        </div>
      )}
      <div className="card" style={{ width: 'min(700px, 100%)', padding: 6 }}>
        <table className="std">
          <thead><tr><th>#</th><th style={{ textAlign: 'left' }}>Squadra</th><th>G</th><th>V</th><th>N</th><th>P</th><th>DR</th><th>Pt</th></tr></thead>
          <tbody>
            {table.map((r, i) => (
              <tr key={r.id} className={r.id === mine ? 'me' : ''}>
                <td>{i + 1}</td><td style={{ textAlign: 'left' }}>{getTeam(r.id).name}</td><td>{r.p}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td><td>{r.gf - r.ga}</td><td><b>{r.pts}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Settings({ onBack, onChange }: { onBack: () => void; onChange: () => void }) {
  const [, force] = useState(0);
  const s = Save.data.settings;
  const toggle = (k: 'sfx' | 'music' | 'voice') => { Save.update((d) => { d.settings[k] = !d.settings[k]; }); Audio.setSettings(Save.data.settings); onChange(); force((x) => x + 1); };
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="screen dim center" style={{ gap: 14 }}>
      <div className="topbar"><Back onBack={onBack} /><h2>Impostazioni</h2><span /></div>
      <DifficultyPicker big />
      <button className={`btn big ${s.music ? 'green' : 'red'}`} onClick={() => toggle('music')}>🎵 Musica: {s.music ? 'SÌ' : 'NO'}</button>
      <button className={`btn big ${s.sfx ? 'green' : 'red'}`} onClick={() => toggle('sfx')} data-testid="toggle-sfx">🔊 Effetti e pubblico: {s.sfx ? 'SÌ' : 'NO'}</button>
      <button className={`btn big ${s.voice ? 'green' : 'red'}`} onClick={() => toggle('voice')}>🗣️ Voce: {s.voice ? 'SÌ' : 'NO'}</button>
      <button className="btn yellow" data-testid="test-music" onClick={() => { Audio.unlock(); Audio.jingle('goal'); }}>🎺 Prova la musica del gol</button>
      <button className="btn" onClick={() => { Save.update((d) => { d.settings.quality = d.settings.quality === 'alta' ? 'media' : 'alta'; }); force((x) => x + 1); onChange(); }}>🖥️ Grafica: {s.quality.toUpperCase()} (si applica al riavvio)</button>
      {/* Area genitori: richiede una pressione lunga per evitare cancellazioni accidentali */}
      {!confirm ? <button className="btn small" style={{ opacity: 0.6 }} onClick={() => setConfirm(true)}>Area genitori: azzera progressi</button> : (
        <div className="card row"><span>Cancellare tutti i progressi?</span><button className="btn small red" onClick={() => { Save.reset(); location.reload(); }}>Sì, azzera</button><button className="btn small" onClick={() => setConfirm(false)}>No</button></div>
      )}
      <p className="rotate-tip">Se non senti la musica: alza il volume e controlla che "Musica" sia su SÌ.</p>
      <p className="rotate-tip">Versione 1.4 · Nessuna pubblicità, nessun acquisto, nessun dato raccolto. I progressi restano su questo dispositivo.</p>
    </div>
  );
}
