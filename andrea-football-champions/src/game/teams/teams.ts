/**
 * Le 20 squadre della Serie A 2026/2027 (verificate: neopromosse Venezia, Frosinone, Monza;
 * retrocesse Pisa, Cremonese, Hellas Verona).
 * Nessuno stemma o marchio ufficiale: solo colori sociali e identità visive originali.
 * I giocatori sono virtuali e inventati.
 */
export type KitPattern = 'solid' | 'stripes' | 'halves' | 'hoops' | 'sash' | 'cross' | 'band';

export interface Kit {
  pattern: KitPattern;
  primary: string;
  secondary: string;
  shorts: string;
  socks: string;
  number: string;
}

export interface Team {
  id: string;
  name: string;
  city: string;
  short: string; // 3 lettere
  nickname: string;
  colors: [string, string];
  home: Kit;
  away: Kit;
  keeperKit: Kit;
  strength: number; // 1..5 (solo per il campionato simulato)
  players: { gk: string; df: string[]; mf: string[]; fw: string[] };
}

const kit = (pattern: KitPattern, primary: string, secondary: string, shorts: string, socks: string, number = '#ffffff'): Kit => ({
  pattern, primary, secondary, shorts, socks, number
});

// Nomi di fantasia, per giocatori virtuali
const FIRST = ['Leo', 'Tommy', 'Gigi', 'Nico', 'Dani', 'Fede', 'Ale', 'Matti', 'Lollo', 'Pietro', 'Marco', 'Rocco', 'Sami', 'Teo', 'Ricky', 'Bruno', 'Ettore', 'Dario', 'Fabio', 'Enzo', 'Luca', 'Paolo', 'Simo', 'Ugo'];
const LAST = ['Rapido', 'Saetta', 'Bomber', 'Muro', 'Fulmine', 'Dribbling', 'Tornado', 'Razzo', 'Volante', 'Cannone', 'Stella', 'Roccia', 'Vento', 'Scatto', 'Magia', 'Tigre', 'Falco', 'Lampo', 'Gol', 'Leone', 'Aquila', 'Delfino', 'Scudo', 'Turbo'];

function makePlayers(seed: number) {
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const name = () => `${FIRST[Math.floor(rnd() * FIRST.length)]} ${LAST[Math.floor(rnd() * LAST.length)]}`;
  return { gk: name(), df: [name(), name(), name(), name()], mf: [name(), name(), name()], fw: [name(), name(), name()] };
}

type Def = Omit<Team, 'players' | 'keeperKit'> & { keeperKit?: Kit };

const DEFS: Def[] = [
  { id: 'atalanta', name: 'Atalanta', city: 'Bergamo', short: 'ATA', nickname: 'La Dea', colors: ['#1f4fa3', '#111111'],
    home: kit('stripes', '#1f4fa3', '#111111', '#111111', '#111111'), away: kit('solid', '#ffffff', '#1f4fa3', '#ffffff', '#ffffff', '#1f4fa3'), strength: 4 },
  { id: 'bologna', name: 'Bologna', city: 'Bologna', short: 'BOL', nickname: 'I Rossoblù', colors: ['#a3122a', '#1a2f6b'],
    home: kit('stripes', '#a3122a', '#1a2f6b', '#ffffff', '#1a2f6b'), away: kit('solid', '#ffffff', '#a3122a', '#ffffff', '#ffffff', '#a3122a'), strength: 3 },
  { id: 'cagliari', name: 'Cagliari', city: 'Cagliari', short: 'CAG', nickname: 'I Rossoblù sardi', colors: ['#b1132b', '#0e2a5c'],
    home: kit('halves', '#b1132b', '#0e2a5c', '#0e2a5c', '#0e2a5c'), away: kit('solid', '#ffffff', '#b1132b', '#ffffff', '#ffffff', '#0e2a5c'), strength: 2 },
  { id: 'como', name: 'Como', city: 'Como', short: 'COM', nickname: 'I Lariani', colors: ['#1b4f9c', '#ffffff'],
    home: kit('solid', '#1b4f9c', '#ffffff', '#1b4f9c', '#1b4f9c'), away: kit('solid', '#ffffff', '#1b4f9c', '#ffffff', '#ffffff', '#1b4f9c'), strength: 3 },
  { id: 'fiorentina', name: 'Fiorentina', city: 'Firenze', short: 'FIO', nickname: 'La Viola', colors: ['#5b2a86', '#ffffff'],
    home: kit('solid', '#5b2a86', '#ffffff', '#ffffff', '#5b2a86'), away: kit('solid', '#ffffff', '#5b2a86', '#5b2a86', '#ffffff', '#5b2a86'), strength: 3 },
  { id: 'frosinone', name: 'Frosinone', city: 'Frosinone', short: 'FRO', nickname: 'I Canarini', colors: ['#f5d10a', '#1d3d8f'],
    home: kit('solid', '#f5d10a', '#1d3d8f', '#1d3d8f', '#f5d10a', '#1d3d8f'), away: kit('solid', '#1d3d8f', '#f5d10a', '#1d3d8f', '#1d3d8f', '#f5d10a'), strength: 2 },
  { id: 'genoa', name: 'Genoa', city: 'Genova', short: 'GEN', nickname: 'Il Grifone', colors: ['#a2182e', '#0d2f6e'],
    home: kit('halves', '#a2182e', '#0d2f6e', '#0d2f6e', '#0d2f6e'), away: kit('solid', '#ffffff', '#a2182e', '#ffffff', '#ffffff', '#0d2f6e'), strength: 2 },
  { id: 'inter', name: 'Inter', city: 'Milano', short: 'INT', nickname: 'I Nerazzurri', colors: ['#0a4ea2', '#111111'],
    home: kit('stripes', '#0a4ea2', '#111111', '#111111', '#111111'), away: kit('solid', '#ffffff', '#0a4ea2', '#ffffff', '#ffffff', '#0a4ea2'), strength: 5 },
  { id: 'juventus', name: 'Juventus', city: 'Torino', short: 'JUV', nickname: 'La Vecchia Signora', colors: ['#111111', '#ffffff'],
    home: kit('stripes', '#ffffff', '#111111', '#ffffff', '#ffffff', '#111111'), away: kit('solid', '#f0c419', '#111111', '#111111', '#111111', '#111111'), strength: 5 },
  { id: 'lazio', name: 'Lazio', city: 'Roma', short: 'LAZ', nickname: 'I Biancocelesti', colors: ['#87c3ea', '#ffffff'],
    home: kit('solid', '#87c3ea', '#ffffff', '#ffffff', '#87c3ea', '#ffffff'), away: kit('solid', '#ffffff', '#87c3ea', '#87c3ea', '#ffffff', '#1d3557'), strength: 4 },
  { id: 'lecce', name: 'Lecce', city: 'Lecce', short: 'LEC', nickname: 'I Giallorossi salentini', colors: ['#f6d10f', '#c8102e'],
    home: kit('stripes', '#f6d10f', '#c8102e', '#1d1d5c', '#c8102e', '#1d1d5c'), away: kit('solid', '#1d1d5c', '#f6d10f', '#1d1d5c', '#1d1d5c', '#f6d10f'), strength: 2 },
  { id: 'milan', name: 'Milan', city: 'Milano', short: 'MIL', nickname: 'I Rossoneri', colors: ['#c8102e', '#111111'],
    home: kit('stripes', '#c8102e', '#111111', '#ffffff', '#111111'), away: kit('solid', '#ffffff', '#c8102e', '#ffffff', '#ffffff', '#c8102e'), strength: 5 },
  { id: 'monza', name: 'Monza', city: 'Monza', short: 'MON', nickname: 'I Brianzoli', colors: ['#d4111f', '#ffffff'],
    home: kit('halves', '#d4111f', '#ffffff', '#ffffff', '#d4111f'), away: kit('solid', '#ffffff', '#d4111f', '#ffffff', '#ffffff', '#d4111f'), strength: 2 },
  { id: 'napoli', name: 'Napoli', city: 'Napoli', short: 'NAP', nickname: 'Gli Azzurri', colors: ['#1a8fd8', '#ffffff'],
    home: kit('solid', '#1a8fd8', '#ffffff', '#ffffff', '#1a8fd8'), away: kit('solid', '#ffffff', '#1a8fd8', '#1a8fd8', '#ffffff', '#1a8fd8'), strength: 5 },
  { id: 'parma', name: 'Parma', city: 'Parma', short: 'PAR', nickname: 'I Crociati', colors: ['#ffffff', '#1a1a1a'],
    home: kit('cross', '#ffffff', '#1a1a1a', '#ffffff', '#ffffff', '#1a1a1a'), away: kit('solid', '#f5d10a', '#1d3d8f', '#1d3d8f', '#f5d10a', '#1d3d8f'), strength: 2 },
  { id: 'roma', name: 'Roma', city: 'Roma', short: 'ROM', nickname: 'I Giallorossi', colors: ['#8e1f2f', '#f0bc42'],
    home: kit('band', '#8e1f2f', '#f0bc42', '#ffffff', '#111111', '#f0bc42'), away: kit('solid', '#ffffff', '#8e1f2f', '#ffffff', '#ffffff', '#8e1f2f'), strength: 4 },
  { id: 'sassuolo', name: 'Sassuolo', city: 'Sassuolo', short: 'SAS', nickname: 'I Neroverdi', colors: ['#00a650', '#111111'],
    home: kit('stripes', '#00a650', '#111111', '#111111', '#111111'), away: kit('solid', '#ffffff', '#00a650', '#ffffff', '#ffffff', '#00a650'), strength: 2 },
  { id: 'torino', name: 'Torino', city: 'Torino', short: 'TOR', nickname: 'Il Toro', colors: ['#7a1f2b', '#ffffff'],
    home: kit('solid', '#7a1f2b', '#ffffff', '#ffffff', '#7a1f2b'), away: kit('sash', '#ffffff', '#7a1f2b', '#ffffff', '#ffffff', '#7a1f2b'), strength: 3 },
  { id: 'udinese', name: 'Udinese', city: 'Udine', short: 'UDI', nickname: 'I Bianconeri friulani', colors: ['#ffffff', '#111111'],
    home: kit('stripes', '#111111', '#ffffff', '#111111', '#ffffff'), away: kit('solid', '#ffffff', '#111111', '#ffffff', '#111111', '#111111'), strength: 3 },
  { id: 'venezia', name: 'Venezia', city: 'Venezia', short: 'VEN', nickname: 'I Lagunari', colors: ['#111111', '#f57c00'],
    home: kit('band', '#111111', '#f57c00', '#111111', '#111111', '#f57c00'), away: kit('solid', '#ffffff', '#0b7a3e', '#ffffff', '#ffffff', '#f57c00'), strength: 2 }
];

export const TEAMS: Team[] = DEFS.map((d, i) => ({
  ...d,
  keeperKit: d.keeperKit ?? kit('solid', ['#2ecc71', '#f39c12', '#9b59b6', '#e84393', '#16a085'][i % 5], '#222222', '#222222', '#222222'),
  players: makePlayers(i + 7)
}));

export const getTeam = (id: string): Team => TEAMS.find((t) => t.id === id) ?? TEAMS[0];

/** Divisa per una partita: se i colori sono troppo simili, l'ospite usa la trasferta. */
export function kitsForMatch(homeId: string, awayId: string): { home: Kit; away: Kit } {
  const h = getTeam(homeId); const a = getTeam(awayId);
  const dist = colorDistance(h.home.primary, a.home.primary);
  return { home: h.home, away: dist < 120 || homeId === awayId ? a.away : a.home };
}

export function colorDistance(c1: string, c2: string): number {
  const p = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [a, b] = [p(c1), p(c2)];
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

/** Divisa speciale sbloccabile, uguale per tutti: "Oro dei Campioni". */
export const SPECIAL_KITS: Record<string, Kit> = {
  oro: kit('solid', '#d4af37', '#ffffff', '#ffffff', '#d4af37', '#ffffff'),
  arcobaleno: kit('hoops', '#e74c3c', '#3498db', '#ffffff', '#f1c40f', '#ffffff'),
  galassia: kit('sash', '#1b1464', '#00d2ff', '#1b1464', '#00d2ff', '#ffffff')
};
