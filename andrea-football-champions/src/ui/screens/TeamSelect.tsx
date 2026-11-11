import { useState } from 'react';
import { TEAMS, SPECIAL_KITS, getTeam } from '../../game/teams/teams';
import { Badge, KitPreview } from '../Badge';
import { Save } from '../../game/save/SaveManager';
import { BALLS, KIT_UNLOCKS } from '../../game/save/rewards';
import { STADIUMS } from '../../game/engine/themes';
import { Audio } from '../../game/audio/AudioManager';

/** Scegli squadra, maglia, pallone e stadio */
export function TeamSelect({ onDone, onBack, first, onStadium }: { onDone: () => void; onBack: () => void; first?: boolean; onStadium: (id: string) => void }) {
  const [tab, setTab] = useState<'squadra' | 'maglia' | 'pallone' | 'stadio'>('squadra');
  const [, force] = useState(0);
  const d = Save.data;
  const stars = Save.totalStars;
  const pick = (fn: () => void) => { Audio.play('click'); fn(); force((x) => x + 1); };
  const team = d.teamId ? getTeam(d.teamId) : null;
  return (
    <div className="screen dim" data-testid="team-select">
      <div className="topbar">
        {!first ? <button className="btn small red" onClick={onBack}>⬅ Indietro</button> : <span />}
        <h2>{first ? 'Scegli la tua squadra!' : 'Scegli Squadra'}</h2>
        <button className="btn small green" disabled={!d.teamId} style={{ opacity: d.teamId ? 1 : 0.4 }} onClick={() => d.teamId && onDone()} data-testid="team-ok">OK ✔</button>
      </div>
      {!first && (
        <div className="tabs">
          {(['squadra', 'maglia', 'pallone', 'stadio'] as const).map((t) => (
            <button key={t} className={`btn small ${tab === t ? 'yellow' : ''}`} onClick={() => setTab(t)}>{t.toUpperCase()}</button>
          ))}
        </div>
      )}
      {tab === 'squadra' && (
        <>
          <p className="rotate-tip">Serie A 2026/2027 · Stemmi e divise sono originali, ispirati ai colori delle squadre</p>
          <div className="team-grid">
            {TEAMS.map((t) => (
              <button key={t.id} className={`team ${d.teamId === t.id ? 'sel' : ''}`} onClick={() => pick(() => Save.update((s) => { s.teamId = t.id; }))} data-testid={`team-${t.id}`}>
                <Badge team={t} size={50} />
                {t.name}
              </button>
            ))}
          </div>
          {team && (
            <div className="card" style={{ marginTop: 12, width: 'min(900px, 100%)' }}>
              <div className="row"><Badge team={team} size={44} /><h3>{team.name} – {team.nickname}</h3></div>
              <p style={{ textAlign: 'center', margin: 4 }}>🧤 {team.players.gk} · 🛡️ {team.players.df.slice(0, 2).join(', ')} · 🎯 {team.players.mf[0]} · ⚽ {team.players.fw.join(', ')}</p>
            </div>
          )}
        </>
      )}
      {tab === 'maglia' && team && (
        <div className="team-grid">
          {KIT_UNLOCKS.map((k) => {
            const ok = k.check(d, stars);
            const kit = k.id === 'casa' ? team.home : k.id === 'trasferta' ? team.away : SPECIAL_KITS[k.id];
            return (
              <button key={k.id} className={`team ${d.kitId === k.id ? 'sel' : ''}`} style={{ opacity: ok ? 1 : 0.45 }} onClick={() => ok && pick(() => Save.update((s) => { s.kitId = k.id; }))}>
                <KitPreview kit={kit} />
                {k.name}
                {!ok && <small>🔒 {k.requirement}</small>}
              </button>
            );
          })}
        </div>
      )}
      {tab === 'pallone' && (
        <div className="team-grid">
          {BALLS.map((b) => {
            const ok = stars >= b.stars;
            return (
              <button key={b.id} className={`team ${d.ballId === b.id ? 'sel' : ''}`} style={{ opacity: ok ? 1 : 0.45 }} onClick={() => ok && pick(() => Save.update((s) => { s.ballId = b.id; }))}>
                <span style={{ fontSize: 44, display: 'inline-block', width: 54, height: 54, borderRadius: '50%', background: `conic-gradient(${b.colors.concat(b.colors[0]).join(',')})` }} />
                {b.name}
                {!ok && <small>🔒 ⭐ {b.stars}</small>}
              </button>
            );
          })}
        </div>
      )}
      {tab === 'stadio' && (
        <div className="team-grid">
          {STADIUMS.map((st) => {
            const ok = stars >= st.unlockStars;
            return (
              <button key={st.id} className={`team ${d.stadiumId === st.id ? 'sel' : ''}`} style={{ opacity: ok ? 1 : 0.45 }} onClick={() => ok && pick(() => { Save.update((s) => { s.stadiumId = st.id; }); onStadium(st.id); })}>
                <span style={{ width: 80, height: 50, borderRadius: 10, background: `linear-gradient(${st.skyTop}, ${st.skyBottom} 60%, ${st.grassA} 60%)`, display: 'block' }} />
                {st.name}
                {!ok && <small>🔒 ⭐ {st.unlockStars}</small>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
