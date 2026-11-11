/** Salvataggio locale dei progressi (solo sul dispositivo, nessun dato inviato). */
export interface TableRow { p: number; w: number; d: number; l: number; gf: number; ga: number; pts: number }
export interface ChampionshipState {
  teamId: string;
  round: number; // giornata da giocare (0-based)
  opponents: string[]; // ordine degli avversari di Andrea
  table: Record<string, TableRow>;
  results: { opp: string; gf: number; ga: number }[];
  finished: boolean;
}

export interface SaveData {
  version: 1;
  welcomed: boolean;
  teamId: string | null;
  stadiumId: string;
  ballId: string;
  kitId: string; // 'casa' | 'trasferta' | id speciale
  levels: Record<number, { stars: number; tries: number }>;
  trophies: string[];
  records: {
    goals: number; passes: number; curlGoals: number; headerGoals: number; cornerGoals: number; longGoals: number;
    penaltiesScored: number; penaltyWins: number; trainingBest: number; quickWins: number; quickPlayed: number; posts: number;
    championships: number;
  };
  championship: ChampionshipState | null;
  settings: { sfx: boolean; music: boolean; voice: boolean; quality: 'alta' | 'media' };
}

const KEY = 'andrea-football-champions-v1';

export const defaultSave = (): SaveData => ({
  version: 1, welcomed: false, teamId: null, stadiumId: 'sole', ballId: 'classico', kitId: 'casa',
  levels: {}, trophies: [],
  records: { goals: 0, passes: 0, curlGoals: 0, headerGoals: 0, cornerGoals: 0, longGoals: 0, penaltiesScored: 0, penaltyWins: 0, trainingBest: 0, quickWins: 0, quickPlayed: 0, posts: 0, championships: 0 },
  championship: null,
  settings: { sfx: true, music: true, voice: true, quality: 'alta' }
});

export interface Storage { getItem(k: string): string | null; setItem(k: string, v: string): void }

export class SaveManager {
  data: SaveData;
  private listeners = new Set<() => void>();
  constructor(private storage: Storage | null = typeof localStorage !== 'undefined' ? localStorage : null) {
    this.data = this.load();
  }

  load(): SaveData {
    try {
      const raw = this.storage?.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        const def = defaultSave();
        return { ...def, ...d, records: { ...def.records, ...d.records }, settings: { ...def.settings, ...d.settings } };
      }
    } catch { /* dati corrotti: si riparte */ }
    return defaultSave();
  }

  save() {
    try { this.storage?.setItem(KEY, JSON.stringify(this.data)); } catch { /* spazio pieno o privato */ }
    this.listeners.forEach((l) => l());
  }

  update(fn: (d: SaveData) => void) { fn(this.data); this.save(); }
  subscribe(l: () => void) { this.listeners.add(l); return () => { this.listeners.delete(l); }; }

  get totalStars() { return Object.values(this.data.levels).reduce((s, l) => s + l.stars, 0); }

  completeLevel(id: number, stars: number) {
    this.update((d) => {
      const prev = d.levels[id];
      const tries = (prev?.tries ?? 0) + 1;
      d.levels[id] = { stars: Math.max(prev?.stars ?? 0, stars), tries };
    });
  }

  isUnlocked(levelId: number) { return levelId === 1 || !!this.data.levels[levelId - 1]; }

  award(trophyId: string): boolean {
    if (this.data.trophies.includes(trophyId)) return false;
    this.update((d) => { d.trophies.push(trophyId); });
    return true;
  }

  reset() { this.data = defaultSave(); this.save(); }
}

export const Save = new SaveManager();
