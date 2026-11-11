// Salvataggio locale dei progressi (solo sul dispositivo, nessun dato inviato altrove).
const KEY = 'afc-save-v1';

const DEFAULT = () => ({
  version: 1,
  firstRunDone: false,
  favoriteTeam: 'inter',
  kit: 'home',               // 'home' | 'away' | id kit speciale
  settings: {
    music: true, sfx: true, voice: true, crowd: true,
    assisted: true, difficulty: 'facile', quality: 'media', celebration: 'aeroplano',
    duration: 3
  },
  stars: 0,
  trophies: {},              // id -> numero di volte vinto
  medals: {},                // drillId -> 'oro' | 'argento' | 'bronzo'
  drillBest: {},             // drillId -> miglior punteggio
  records: { matches: 0, wins: 0, draws: 0, losses: 0, goals: 0, conceded: 0, maxGoalsMatch: 0,
             biggestWin: 0, penaltiesScored: 0, penaltiesSaved: 0, shootoutsWon: 0, quickWins: 0 },
  achievements: {},          // id -> timestamp
  league: null
});

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT();
    const d = JSON.parse(raw);
    const base = DEFAULT();
    return { ...base, ...d, settings: { ...base.settings, ...(d.settings || {}) },
      records: { ...base.records, ...(d.records || {}) } };
  } catch (e) { return DEFAULT(); }
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* memoria piena o non disponibile */ }
}

export function get() { return state; }
export function settings() { return state.settings; }
export function setSetting(k, v) { state.settings[k] = v; save(); }

export function reset() {
  state = DEFAULT();
  state.firstRunDone = true;
  save();
}

// ---------- Obiettivi ----------
export const ACHIEVEMENTS = [
  { id: 'primo_gol',      name: 'Primo gol!',            desc: 'Segna il tuo primo gol' },
  { id: 'prima_vittoria', name: 'Prima vittoria',        desc: 'Vinci una partita' },
  { id: 'gol10',          name: 'Bomber',                desc: 'Segna 10 gol in totale' },
  { id: 'gol50',          name: 'Super bomber',          desc: 'Segna 50 gol in totale' },
  { id: 'tripletta',      name: 'Tripletta',             desc: 'Segna 3 gol in una partita' },
  { id: 'porta_chiusa',   name: 'Porta chiusa',          desc: 'Vinci senza subire gol' },
  { id: 'partite5',       name: 'Sempre in campo',       desc: 'Gioca 5 partite' },
  { id: 'rigore_parato',  name: 'Para tutto!',           desc: 'Para un rigore' },
  { id: 'serie_rigori',   name: 'Re dei rigori',         desc: 'Vinci una serie di rigori' },
  { id: 'allenato',       name: 'Allenamento completo',  desc: 'Prendi una medaglia in ogni allenamento' },
  { id: 'tutto_oro',      name: 'Tutto oro',             desc: 'Medaglia d\'oro in ogni allenamento' },
  { id: 'stelle50',       name: 'Pioggia di stelle',     desc: 'Raccogli 50 stelle' },
  { id: 'stelle150',      name: 'Cielo stellato',        desc: 'Raccogli 150 stelle' },
  { id: 'campione',       name: 'Campione d\'Italia',     desc: 'Vinci il campionato' }
];

export const CUPS = [
  { id: 'coppa_veloce',   name: 'Coppa Partita Veloce', desc: 'Vinci 5 partite veloci', color: '#4fb3ff' },
  { id: 'coppa_rigori',   name: 'Coppa dei Rigori',     desc: 'Vinci una serie di rigori', color: '#ff7a59' },
  { id: 'coppa_allenamento', name: 'Coppa Allenamento', desc: 'Medaglia in ogni allenamento', color: '#4cd18a' },
  { id: 'scudetto',       name: 'Scudetto',             desc: 'Vinci il campionato', color: '#ffd23f' },
  { id: 'super_coppa',    name: 'Super Coppa Andrea',   desc: 'Conquista tutte le altre coppe', color: '#c58cff' }
];

export const CELEBRATIONS = [
  { id: 'aeroplano', name: 'Aeroplano', stars: 0 },
  { id: 'salto',     name: 'Super salto', stars: 10 },
  { id: 'capriola',  name: 'Capriola', stars: 40 },
  { id: 'ballo',     name: 'Ballo', stars: 80 }
];

// restituisce la lista dei nuovi sblocchi
export function addStars(n) {
  const before = state.stars;
  state.stars += n;
  const unlocked = [];
  for (const c of CELEBRATIONS) if (c.stars > before && c.stars <= state.stars) unlocked.push('Nuova esultanza: ' + c.name);
  if (state.stars >= 50) unlock('stelle50');
  if (state.stars >= 150) unlock('stelle150');
  save();
  return unlocked;
}

const pendingNews = [];
export function unlock(id) {
  if (state.achievements[id]) return false;
  state.achievements[id] = Date.now();
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (a) pendingNews.push('Obiettivo: ' + a.name);
  save();
  return true;
}
export function winCup(id) {
  const first = !state.trophies[id];
  state.trophies[id] = (state.trophies[id] || 0) + 1;
  const c = CUPS.find(x => x.id === id);
  if (first && c) pendingNews.push('Nuova coppa: ' + c.name);
  const others = CUPS.filter(x => x.id !== 'super_coppa');
  if (!state.trophies.super_coppa && others.every(x => state.trophies[x.id])) {
    state.trophies.super_coppa = 1; pendingNews.push('Nuova coppa: Super Coppa Andrea');
  }
  save();
}
export function takeNews() { return pendingNews.splice(0); }

export function recordMatch(gf, ga, mode) {
  const r = state.records;
  r.matches++; r.goals += gf; r.conceded += ga;
  if (gf > ga) r.wins++; else if (gf === ga) r.draws++; else r.losses++;
  r.maxGoalsMatch = Math.max(r.maxGoalsMatch, gf);
  r.biggestWin = Math.max(r.biggestWin, gf - ga);
  if (gf > 0) unlock('primo_gol');
  if (gf > ga) unlock('prima_vittoria');
  if (gf > ga && ga === 0) unlock('porta_chiusa');
  if (gf >= 3) unlock('tripletta');
  if (r.goals >= 10) unlock('gol10');
  if (r.goals >= 50) unlock('gol50');
  if (r.matches >= 5) unlock('partite5');
  if (mode === 'quick' && gf > ga) {
    r.quickWins++;
    if (r.quickWins % 5 === 0) winCup('coppa_veloce');
  }
  // stelle: si guadagna sempre qualcosa, anche perdendo
  const stars = gf > ga ? 3 : gf === ga ? 2 : 1;
  const news = addStars(stars + Math.min(gf, 3));
  save();
  return { stars: stars + Math.min(gf, 3), news };
}

export function setMedal(drill, medal, score, lower = false) {
  const order = { bronzo: 1, argento: 2, oro: 3 };
  const prev = state.drillBest[drill];
  if (prev == null || (lower ? score < prev : score > prev)) state.drillBest[drill] = score;
  if (medal && (order[medal] > (order[state.medals[drill]] || 0))) state.medals[drill] = medal;
  save();
}
