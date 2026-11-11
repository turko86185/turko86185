// CAMPIONATO: calendario (girone all'italiana), classifica, simulazione delle altre partite.
import * as Store from './store.js';
import * as Teams from './teams.js';

// metodo del cerchio: ogni squadra incontra tutte le altre una volta (19 giornate con 20 squadre)
export function makeSchedule(ids, seed = Date.now()) {
  const list = ids.slice();
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  if (list.length % 2) list.push(null);
  const n = list.length, rounds = [];
  const arr = list.slice();
  for (let r = 0; r < n - 1; r++) {
    const games = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      if (a && b) games.push(r % 2 ? [b, a] : [a, b]);
    }
    rounds.push(games);
    arr.splice(1, 0, arr.pop());
  }
  return rounds;
}

export function newLeague(userTeam) {
  const ids = Teams.teams().map(t => t.id);
  const L = {
    user: userTeam, round: 0, schedule: makeSchedule(ids),
    table: Object.fromEntries(ids.map(id => [id, { pt: 0, g: 0, v: 0, n: 0, p: 0, gf: 0, gs: 0 }])),
    results: [], finished: false
  };
  Store.get().league = L; Store.save();
  return L;
}
export const current = () => Store.get().league;

export function nextMatch() {
  const L = current();
  if (!L || L.finished) return null;
  const g = L.schedule[L.round].find(m => m.includes(L.user));
  return { home: g[0], away: g[1], round: L.round + 1, rounds: L.schedule.length };
}

function simScore(a, b) {
  const ta = Teams.team(a), tb = Teams.team(b);
  const diff = (ta.rating - tb.rating) / 20;
  const lam = x => Math.max(0.3, 1.35 + x);
  return [poisson(lam(diff + 0.15)), poisson(lam(-diff))];
}
function poisson(l) { let L = Math.exp(-l), k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L); return Math.min(6, k - 1); }

function apply(L, h, a, gh, ga) {
  const H = L.table[h], A = L.table[a];
  H.g++; A.g++; H.gf += gh; H.gs += ga; A.gf += ga; A.gs += gh;
  if (gh > ga) { H.v++; H.pt += 3; A.p++; } else if (gh < ga) { A.v++; A.pt += 3; H.p++; } else { H.n++; A.n++; H.pt++; A.pt++; }
}

// registra il risultato della partita di Andrea e simula le altre della giornata
export function recordUserResult(userGoals, oppGoals) {
  const L = current();
  const games = L.schedule[L.round];
  const res = [];
  for (const [h, a] of games) {
    let gh, ga;
    if (h === L.user) { gh = userGoals; ga = oppGoals; }
    else if (a === L.user) { gh = oppGoals; ga = userGoals; }
    else [gh, ga] = simScore(h, a);
    apply(L, h, a, gh, ga);
    res.push([h, a, gh, ga]);
  }
  L.results.push(res);
  L.round++;
  if (L.round >= L.schedule.length) L.finished = true;
  Store.save();
  return { results: res, finished: L.finished, position: position(L.user) };
}

export function standings() {
  const L = current();
  return Object.entries(L.table).map(([id, r]) => ({ id, ...r, dr: r.gf - r.gs }))
    .sort((x, y) => y.pt - x.pt || y.dr - x.dr || y.gf - x.gf || Teams.team(x.id).name.localeCompare(Teams.team(y.id).name));
}
export function position(id) { return standings().findIndex(r => r.id === id) + 1; }
