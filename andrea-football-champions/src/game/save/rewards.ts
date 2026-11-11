import type { SaveData } from './SaveManager';

export interface Trophy { id: string; name: string; desc: string; icon: string; kind: 'medaglia' | 'trofeo' | 'coppa' }

export const TROPHIES: Trophy[] = [
  { id: 'primo-gol', name: 'Primo Gol', desc: 'Hai segnato il tuo primo gol!', icon: '⚽', kind: 'medaglia' },
  { id: 'primo-passaggio', name: 'Primo Passaggio', desc: 'Hai fatto il primo passaggio!', icon: '👟', kind: 'medaglia' },
  { id: 'gol-10', name: 'Bomber', desc: '10 gol segnati', icon: '🥉', kind: 'medaglia' },
  { id: 'gol-50', name: 'Super Bomber', desc: '50 gol segnati', icon: '🥈', kind: 'medaglia' },
  { id: 'gol-100', name: 'Leggenda del Gol', desc: '100 gol segnati', icon: '🥇', kind: 'medaglia' },
  { id: 'effetto', name: 'Tiro a Effetto', desc: 'Gol con un tiro curvo', icon: '🌀', kind: 'medaglia' },
  { id: 'testa', name: 'Colpo di Testa', desc: 'Gol di testa', icon: '🙆', kind: 'medaglia' },
  { id: 'angolino', name: 'Nell\'Angolino', desc: 'Gol nell\'angolino', icon: '🎯', kind: 'medaglia' },
  { id: 'palo', name: 'Che Palo!', desc: 'Hai colpito il palo', icon: '🪵', kind: 'medaglia' },
  { id: 'capitolo-1', name: 'Allievo', desc: 'Capitolo 1 completato', icon: '🏅', kind: 'trofeo' },
  { id: 'capitolo-2', name: 'Attaccante', desc: 'Capitolo 2 completato', icon: '🏆', kind: 'trofeo' },
  { id: 'capitolo-3', name: 'Campione di Serie A', desc: 'Capitolo 3 completato', icon: '🏆', kind: 'trofeo' },
  { id: 'coppa-livelli', name: 'Coppa dei Campioni', desc: 'Hai vinto la Finale!', icon: '🏆', kind: 'coppa' },
  { id: 'coppa-campionato', name: 'Scudetto di Andrea', desc: 'Hai vinto il Campionato', icon: '🛡️', kind: 'coppa' },
  { id: 'coppa-rigori', name: 'Re dei Rigori', desc: 'Hai vinto una sfida ai rigori', icon: '🥅', kind: 'coppa' },
  { id: 'vittoria-veloce', name: 'Prima Vittoria', desc: 'Hai vinto una partita veloce', icon: '🎉', kind: 'trofeo' },
  { id: 'allenamento', name: 'Grande Allenamento', desc: '10 punti in allenamento', icon: '💪', kind: 'medaglia' },
  { id: 'stelle-100', name: 'Pioggia di Stelle', desc: '100 stelle raccolte', icon: '🌟', kind: 'trofeo' }
];

export interface BallSkin { id: string; name: string; stars: number; colors: string[]; pattern: 'classico' | 'stelle' | 'righe' | 'fuoco' | 'oro' }
export const BALLS: BallSkin[] = [
  { id: 'classico', name: 'Classico', stars: 0, colors: ['#ffffff', '#111111'], pattern: 'classico' },
  { id: 'arcobaleno', name: 'Arcobaleno', stars: 15, colors: ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6'], pattern: 'righe' },
  { id: 'stelle', name: 'Stellare', stars: 40, colors: ['#1b2a6b', '#ffd700'], pattern: 'stelle' },
  { id: 'fuoco', name: 'Palla di Fuoco', stars: 90, colors: ['#ff4500', '#ffd000'], pattern: 'fuoco' },
  { id: 'oro', name: 'Pallone d\'Oro', stars: 180, colors: ['#d4af37', '#fff3b0'], pattern: 'oro' }
];

export interface KitUnlock { id: string; name: string; requirement: string; check: (d: SaveData, stars: number) => boolean }
export const KIT_UNLOCKS: KitUnlock[] = [
  { id: 'casa', name: 'Maglia di Casa', requirement: 'Sempre disponibile', check: () => true },
  { id: 'trasferta', name: 'Maglia da Trasferta', requirement: 'Sempre disponibile', check: () => true },
  { id: 'arcobaleno', name: 'Maglia Arcobaleno', requirement: 'Completa il Capitolo 1', check: (d) => d.trophies.includes('capitolo-1') },
  { id: 'galassia', name: 'Maglia Galassia', requirement: 'Raccogli 60 stelle', check: (_d, s) => s >= 60 },
  { id: 'oro', name: 'Maglia d\'Oro', requirement: 'Vinci una coppa', check: (d) => d.trophies.some((t) => t.startsWith('coppa')) }
];
