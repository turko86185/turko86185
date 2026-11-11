// Andrea Football Champions — interfaccia, menu, flussi di gioco, premi.
import * as THREE from './vendor/three.module.min.js';
import * as Store from './store.js';
import * as Audio from './audio.js';
import * as Teams from './teams.js';
import * as League from './league.js';
import { setupControls, resetInput, input } from './controls.js';
import { MatchGame } from './engine/match.js';
import { PenaltyGame } from './engine/penalty.js';
import { TrainingGame, DRILLS, medalFor } from './engine/training.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const S = () => Store.settings();

// ---------------- grafica: icone, mascotte, coppe ----------------
const ICONS = {
  play: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="29" fill="#fff"/><path d="M26 18 L48 32 L26 46 Z" fill="#ff4f6d"/></svg>',
  ball: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="#fff"/><path d="M32 20 l10 7 -4 12 h-12 l-4 -12z" fill="#18213d"/><path d="M32 4v16M42 27l20-6M38 39l12 16M26 39l-12 16M22 27L2 21" stroke="#18213d" stroke-width="3"/></svg>',
  table: '<svg viewBox="0 0 64 64"><rect x="6" y="8" width="52" height="48" rx="8" fill="#fff"/><rect x="12" y="16" width="40" height="7" rx="3" fill="#ffd23f"/><rect x="12" y="28" width="40" height="7" rx="3" fill="#cfe0ff"/><rect x="12" y="40" width="40" height="7" rx="3" fill="#cfe0ff"/></svg>',
  goal: '<svg viewBox="0 0 64 64"><path d="M6 50V14h52v36" fill="none" stroke="#fff" stroke-width="6" stroke-linejoin="round"/><path d="M12 20h40M12 30h40M12 40h40M22 14v36M32 14v36M42 14v36" stroke="#fff" stroke-width="1.5" opacity=".7"/><circle cx="32" cy="52" r="8" fill="#fff" stroke="#18213d" stroke-width="2"/></svg>',
  cone: '<svg viewBox="0 0 64 64"><path d="M32 6 L48 52 H16 Z" fill="#ff7a1a"/><path d="M24 30h16M20 42h24" stroke="#fff" stroke-width="5"/><rect x="8" y="52" width="48" height="6" rx="3" fill="#fff"/></svg>',
  cup: '<svg viewBox="0 0 64 64"><path d="M18 8h28v14a14 14 0 0 1-28 0z" fill="#fff"/><path d="M18 12H8a10 10 0 0 0 12 14M46 12h10a10 10 0 0 1-12 14" fill="none" stroke="#fff" stroke-width="4"/><rect x="28" y="36" width="8" height="10" fill="#fff"/><rect x="18" y="46" width="28" height="10" rx="3" fill="#fff"/></svg>',
  shirt: '<svg viewBox="0 0 64 64"><path d="M22 6 L10 12 L4 26 L14 30 L16 24 V58 H48 V24 L50 30 L60 26 L54 12 L42 6 Q32 14 22 6Z" fill="#fff"/><text x="32" y="46" text-anchor="middle" font-size="18" font-weight="700" fill="#7a45e0" font-family="Fredoka,Arial">10</text></svg>',
  gear: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="20" fill="none" stroke="#fff" stroke-width="10" stroke-dasharray="8 6"/><circle cx="32" cy="32" r="12" fill="#fff"/><circle cx="32" cy="32" r="5" fill="#5b6a8c"/></svg>'
};

function mascotSVG() {
  // "Leo", il leoncino mascotte del gioco (personaggio originale)
  return `<svg viewBox="0 0 200 220" aria-label="Leo la mascotte">
  <g class="body-bob">
    <g class="arm"><path d="M148 128 Q178 100 176 66" stroke="#f0a33a" stroke-width="18" stroke-linecap="round" fill="none"/><circle cx="176" cy="62" r="14" fill="#f7c35a"/></g>
    <path d="M52 128 Q30 150 40 176" stroke="#f0a33a" stroke-width="18" stroke-linecap="round" fill="none"/>
    <path d="M58 120 Q100 108 142 120 L150 190 Q100 204 50 190 Z" fill="#2f7bff"/>
    <path d="M58 120 Q100 108 142 120 L144 136 Q100 126 56 136 Z" fill="#ffd23f"/>
    <text x="100" y="176" text-anchor="middle" font-family="Fredoka,Arial" font-weight="700" font-size="40" fill="#fff">10</text>
    <rect x="66" y="190" width="24" height="22" rx="8" fill="#f0a33a"/><rect x="110" y="190" width="24" height="22" rx="8" fill="#f0a33a"/>
    <ellipse cx="78" cy="214" rx="18" ry="7" fill="#ff4f6d"/><ellipse cx="122" cy="214" rx="18" ry="7" fill="#ff4f6d"/>
    <g>
      ${Array.from({ length: 14 }, (_, i) => { const a = i / 14 * Math.PI * 2; return `<circle cx="${100 + Math.cos(a) * 52}" cy="${78 + Math.sin(a) * 50}" r="20" fill="#c9661e"/>`; }).join('')}
      <circle cx="100" cy="78" r="50" fill="#e07b25"/>
      <circle cx="62" cy="40" r="13" fill="#f7c35a"/><circle cx="138" cy="40" r="13" fill="#f7c35a"/>
      <circle cx="100" cy="84" r="42" fill="#f7c35a"/>
      <g class="eyes"><ellipse cx="84" cy="76" rx="8" ry="10" fill="#18213d"/><ellipse cx="116" cy="76" rx="8" ry="10" fill="#18213d"/><circle cx="87" cy="72" r="3" fill="#fff"/><circle cx="119" cy="72" r="3" fill="#fff"/></g>
      <ellipse cx="100" cy="94" rx="9" ry="6" fill="#7a3a12"/>
      <circle cx="74" cy="98" r="7" fill="#ff9aa8" opacity=".6"/><circle cx="126" cy="98" r="7" fill="#ff9aa8" opacity=".6"/>
      <path class="mouth-closed" d="M86 106 Q100 118 114 106" stroke="#7a3a12" stroke-width="4" fill="none" stroke-linecap="round"/>
      <ellipse class="mouth-open" cx="100" cy="110" rx="11" ry="9" fill="#7a2020"/>
    </g>
  </g></svg>`;
}

function cupSVG(color) {
  return `<svg viewBox="0 0 80 90"><path d="M20 8h40v20a20 20 0 0 1-40 0z" fill="${color}"/><path d="M20 14H8a12 12 0 0 0 14 18M60 14h12a12 12 0 0 1-14 18" fill="none" stroke="${color}" stroke-width="5"/>
    <rect x="35" y="46" width="10" height="16" fill="${color}"/><rect x="22" y="62" width="36" height="12" rx="3" fill="#5b4a2a"/><rect x="16" y="74" width="48" height="10" rx="3" fill="#3d311b"/>
    <path d="M30 14 v16" stroke="#fff" stroke-width="4" opacity=".55" stroke-linecap="round"/></svg>`;
}

// ---------------- navigazione ----------------
let current = 'loading';
const history = [];
function show(id, push = true) {
  if (push && current !== id) history.push(current);
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'scr-' + id));
  current = id;
  const fn = { menu: enterMenu, quick: renderQuick, team: renderTeam, league: renderLeague, penalty: renderPenalty, training: renderTraining, trophies: renderTrophies, settings: renderSettings }[id];
  if (fn) fn();
}
function back() {
  Audio.sfx('click');
  show('menu', false);
  history.length = 0;
}

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 2600);
}

// mascotte che parla
function speak(mascotEl, bubbleEl, text, html) {
  bubbleEl.innerHTML = html || text;
  mascotEl.classList.add('talking');
  Audio.say(text, { pitch: 1.3, rate: 1.0 });
  clearTimeout(mascotEl._t);
  mascotEl._t = setTimeout(() => mascotEl.classList.remove('talking'), Math.min(6000, 600 + text.length * 60));
}

const WELCOME_TEXT = 'Ciao Andrea! Benvenuto nel tuo stadio! Sei pronto a diventare un grande campione di calcio? Scegli la tua squadra e scendi in campo!';
const WELCOME_HTML = 'Ciao <b>Andrea</b>! Benvenuto nel tuo stadio! Sei pronto a diventare un grande campione di calcio? Scegli la tua squadra e scendi in campo!';
const MENU_LINES = ['Bentornato Andrea! Pronto per un\'altra partita?', 'Ciao campione! Si gioca?', 'Forza Andrea! Scegli cosa fare!', 'Eccoti Andrea! Oggi segniamo tanti gol!'];

function enterMenu() {
  $('#starCount').textContent = Store.get().stars;
  const line = MENU_LINES[Math.floor(Math.random() * MENU_LINES.length)];
  speak($('#mascotSmall'), $('#menuBubble'), line);
  Audio.musicStart();
}

// ---------------- selettori ----------------
function teamCard(t, sel) {
  return `<button class="tcard ${sel ? 'sel' : ''}" data-team="${t.id}">${Teams.badgeSVG(t, 58)}<span>${t.name}</span></button>`;
}
function picker(el, selected, onPick, exclude) {
  el.innerHTML = Teams.teams().map(t => teamCard(t, t.id === selected)).join('');
  el.querySelectorAll('.tcard').forEach(b => b.onclick = () => {
    Audio.sfx('click');
    el.querySelectorAll('.tcard').forEach(x => x.classList.toggle('sel', x === b));
    onPick(b.dataset.team);
  });
}
function chips(el, items, selected, onPick) {
  el.innerHTML = items.map(i => `<button class="chip ${i.v === selected ? 'sel' : ''} ${i.locked ? 'locked' : ''}" data-v="${i.v}">${i.label}</button>`).join('');
  el.querySelectorAll('.chip').forEach(b => b.onclick = () => {
    const it = items.find(i => String(i.v) === b.dataset.v);
    if (it.locked) { Audio.sfx('fail'); toast(it.lockMsg || 'Ancora bloccato'); return; }
    Audio.sfx('click');
    el.querySelectorAll('.chip').forEach(x => x.classList.toggle('sel', x === b));
    onPick(it.v);
  });
}
const DIFFS = [{ v: 'facile', label: 'Facile' }, { v: 'normale', label: 'Normale' }, { v: 'difficile', label: 'Difficile' }];
const DURS = [{ v: 2, label: '2 minuti' }, { v: 3, label: '3 minuti' }, { v: 5, label: '5 minuti' }, { v: 8, label: '8 minuti' }];

// ---------------- partita veloce ----------------
const quick = { home: null, away: null, stadium: 'sole' };
function renderQuick() {
  quick.home = quick.home || Store.get().favoriteTeam;
  if (!quick.away || quick.away === quick.home) quick.away = randomOpponent(quick.home);
  picker($('#pickHome'), quick.home, id => { quick.home = id; if (quick.away === id) { quick.away = randomOpponent(id); picker($('#pickAway'), quick.away, v => quick.away = v); } });
  picker($('#pickAway'), quick.away, id => quick.away = id);
  chips($('#chipStadium'), Teams.stadiums().map(s => ({ v: s.id, label: s.name })), quick.stadium, v => quick.stadium = v);
  chips($('#chipDuration'), DURS, S().duration, v => Store.setSetting('duration', v));
  chips($('#chipDiff'), DIFFS, S().difficulty, v => Store.setSetting('difficulty', v));
}
function randomOpponent(not) {
  const ts = Teams.teams().filter(t => t.id !== not);
  return ts[Math.floor(Math.random() * ts.length)].id;
}

// ---------------- squadra del cuore e divise ----------------
function kitOptions(t) {
  const st = Store.get().stars;
  return [{ v: 'home', label: 'Casa', kit: t.home }, { v: 'away', label: 'Trasferta', kit: t.away },
    ...Teams.specialKits().map(k => ({ v: k.id, label: k.name, kit: k.kit, locked: st < k.stars, lockMsg: `Servono ${k.stars} stelle per sbloccarla!` }))];
}
function drawKit(kit) {
  const c = $('#kitPreview'), g = c.getContext('2d');
  g.clearRect(0, 0, 220, 220);
  const tex = Teams.shirtCanvas(kit, 10);
  g.save();
  g.beginPath();
  g.moveTo(70, 30); g.lineTo(30, 52); g.lineTo(12, 96); g.lineTo(46, 108); g.lineTo(52, 90); g.lineTo(52, 196); g.lineTo(168, 196); g.lineTo(168, 90); g.lineTo(174, 108); g.lineTo(208, 96); g.lineTo(190, 52); g.lineTo(150, 30); g.quadraticCurveTo(110, 58, 70, 30);
  g.closePath(); g.clip();
  g.drawImage(tex, 0, 0, 128, 128, 0, 20, 220, 200);
  g.restore();
  g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,.25)'; g.stroke();
  g.font = '700 54px Fredoka, Arial'; g.textAlign = 'center';
  const bright = Teams.luminance(kit.c1) > 0.6;
  g.fillStyle = bright ? '#18213d' : '#ffffff'; g.fillText('10', 110, 160);
}
function renderTeam() {
  const st = Store.get();
  const t = Teams.team(st.favoriteTeam);
  $('#teamHeroName').textContent = t.name;
  const opts = kitOptions(t);
  if (!opts.find(o => o.v === st.kit && !o.locked)) st.kit = 'home';
  drawKit(opts.find(o => o.v === st.kit).kit);
  chips($('#chipKit'), opts, st.kit, v => { st.kit = v; Store.save(); drawKit(opts.find(o => o.v === v).kit); });
  const grid = $('#teamGrid');
  grid.innerHTML = Teams.teams().map(x => teamCard(x, x.id === st.favoriteTeam)).join('');
  grid.querySelectorAll('.tcard').forEach(b => b.onclick = () => {
    Audio.sfx('click'); st.favoriteTeam = b.dataset.team; Store.save(); quick.home = st.favoriteTeam;
    Audio.say('Forza ' + Teams.team(st.favoriteTeam).name + '!');
    renderTeam();
  });
}

// ---------------- campionato ----------------
function renderLeague() {
  $('#seasonLbl').textContent = 'Serie A ' + Teams.data().season;
  const body = $('#leagueBody');
  const L = League.current();
  if (!L) {
    const fav = Store.get().favoriteTeam;
    body.innerHTML = `<p class="lead">Scegli la tua squadra e gioca contro tutte le altre squadre della Serie A (19 giornate). Chi fa più punti vince lo Scudetto!</p>
      <div class="team-picker" id="pickLeague"></div><div class="cta-row"><button class="btn-go" id="btnLeagueNew">INIZIA IL CAMPIONATO</button></div>`;
    let pick = fav;
    picker($('#pickLeague'), fav, v => pick = v);
    $('#btnLeagueNew').onclick = () => { Audio.sfx('big'); League.newLeague(pick); renderLeague(); };
    return;
  }
  const rows = League.standings();
  const nm = League.nextMatch();
  let head = '';
  if (nm) {
    const h = Teams.team(nm.home), a = Teams.team(nm.away);
    head = `<div class="next-card"><div><div class="round">Giornata ${nm.round} di ${nm.rounds}</div>
      <div class="vs">${Teams.badgeSVG(h, 54)} ${h.name} - ${a.name} ${Teams.badgeSVG(a, 54)}</div></div>
      <button class="btn-go" id="btnLeaguePlay">GIOCA!</button></div>`;
  } else {
    const pos = League.position(L.user);
    head = `<div class="next-card"><div class="vs">Campionato finito! ${Teams.team(L.user).name}: ${pos}° posto ${pos === 1 ? '— CAMPIONE D\'ITALIA!' : ''}</div>
      <button class="btn-go" id="btnLeagueAgain">NUOVO CAMPIONATO</button></div>`;
  }
  const last = L.results.length ? L.results[L.results.length - 1] : null;
  const table = `<div class="table-wrap"><table class="standings"><thead><tr><th>#</th><th style="text-align:left">Squadra</th><th>Pt</th><th>G</th><th>V</th><th>N</th><th>P</th><th>GF</th><th>GS</th></tr></thead><tbody>
    ${rows.map((r, i) => { const t = Teams.team(r.id); return `<tr class="${r.id === L.user ? 'me' : ''}"><td>${i + 1}</td><td class="tn">${Teams.badgeSVG(t, 26)}${t.name}</td><td class="pt">${r.pt}</td><td>${r.g}</td><td>${r.v}</td><td>${r.n}</td><td>${r.p}</td><td>${r.gf}</td><td>${r.gs}</td></tr>`; }).join('')}
    </tbody></table></div>`;
  const lastHtml = last ? `<h3>Risultati della giornata ${L.results.length}</h3><div class="results-list">${last.map(([h, a, x, y]) => `<div>${Teams.team(h).name} ${x} - ${y} ${Teams.team(a).name}</div>`).join('')}</div>` : '';
  body.innerHTML = head + table + lastHtml + `<div class="cta-row"><button class="btn-soft" id="btnLeagueReset">Ricomincia il campionato</button></div>`;
  if ($('#btnLeaguePlay')) $('#btnLeaguePlay').onclick = () => {
    const n = League.nextMatch();
    const userHome = n.home === L.user;
    startMatch({ mode: 'league', home: L.user, away: userHome ? n.away : n.home, stadium: Teams.stadiums()[L.round % Teams.stadiums().length].id });
  };
  if ($('#btnLeagueAgain')) $('#btnLeagueAgain').onclick = () => { Store.get().league = null; Store.save(); renderLeague(); };
  holdButton($('#btnLeagueReset'), () => { Store.get().league = null; Store.save(); renderLeague(); toast('Campionato azzerato'); });
}

// pulsante "tieni premuto" (evita tocchi accidentali)
function holdButton(btn, fn, ms = 1500) {
  if (!btn) return;
  btn.classList.add('hold-btn');
  const fill = document.createElement('span'); fill.className = 'fill'; btn.prepend(fill);
  let t0 = 0, raf = 0;
  const tick = () => { const k = Math.min(1, (performance.now() - t0) / ms); fill.style.width = k * 100 + '%'; if (k >= 1) { stop(); fn(); } else raf = requestAnimationFrame(tick); };
  const stop = () => { cancelAnimationFrame(raf); fill.style.width = '0'; };
  btn.addEventListener('pointerdown', () => { t0 = performance.now(); raf = requestAnimationFrame(tick); });
  btn.addEventListener('pointerup', stop); btn.addEventListener('pointerleave', stop); btn.addEventListener('pointercancel', stop);
  btn.onclick = () => { if (!btn._hinted) { toast('Tieni premuto il pulsante'); } };
}

// ---------------- rigori ----------------
let penOpp = null;
function renderPenalty() {
  const fav = Store.get().favoriteTeam;
  if (!penOpp || penOpp === fav) penOpp = randomOpponent(fav);
  picker($('#pickPen'), penOpp, v => penOpp = v);
}

// ---------------- allenamento ----------------
function renderTraining() {
  const st = Store.get();
  $('#drillGrid').innerHTML = DRILLS.map(d => {
    const m = st.medals[d.id], best = st.drillBest[d.id];
    return `<button class="drill" data-drill="${d.id}"><b>${d.name}</b><span>${d.desc}</span>
      ${m ? `<span class="medal ${m}"><i></i>${m[0].toUpperCase() + m.slice(1)}</span>` : '<span class="medal">Nessuna medaglia</span>'}
      ${best != null ? `<span>Record: ${best} ${d.unit}</span>` : ''}</button>`;
  }).join('');
  $$('#drillGrid .drill').forEach(b => b.onclick = () => {
    Audio.sfx('big');
    const id = b.dataset.drill;
    if (id === 'rigori') startPenalty({ practice: true });
    else startTraining(id);
  });
}

// ---------------- coppe e premi ----------------
function renderTrophies() {
  const st = Store.get(), r = st.records;
  const cups = Store.CUPS.map(c => `<div class="cup ${st.trophies[c.id] ? '' : 'locked'}">${cupSVG(c.color)}<b>${c.name}</b><span>${st.trophies[c.id] ? 'Vinta ' + (st.trophies[c.id] > 1 ? st.trophies[c.id] + ' volte' : '!') : c.desc}</span></div>`).join('');
  const medals = DRILLS.map(d => { const m = st.medals[d.id]; return `<div class="rec"><span>${d.name}</span><div>${m ? `<span class="medal ${m}"><i></i>${m}</span>` : '<span class="medal">—</span>'}</div></div>`; }).join('');
  const recs = [['Stelle', st.stars], ['Partite', r.matches], ['Vittorie', r.wins], ['Pareggi', r.draws], ['Gol segnati', r.goals], ['Più gol in una partita', r.maxGoalsMatch], ['Vittoria più larga', r.biggestWin ? '+' + r.biggestWin : 0], ['Rigori segnati', r.penaltiesScored], ['Rigori parati', r.penaltiesSaved]]
    .map(([k, v]) => `<div class="rec"><b>${v}</b><span>${k}</span></div>`).join('');
  const ach = Store.ACHIEVEMENTS.map(a => `<div class="${st.achievements[a.id] ? '' : 'off'}"><i></i><div>${a.name}<small>${a.desc}</small></div></div>`).join('');
  const cel = Store.CELEBRATIONS.map(c => `<div class="${st.stars >= c.stars ? '' : 'off'}"><i></i><div>Esultanza: ${c.name}<small>${c.stars ? c.stars + ' stelle' : 'Sbloccata'}</small></div></div>`).join('');
  const kits = Teams.specialKits().map(k => `<div class="${st.stars >= k.stars ? '' : 'off'}"><i></i><div>Divisa ${k.name}<small>${k.stars} stelle</small></div></div>`).join('');
  $('#trophyBody').innerHTML = `<h3>Coppe</h3><div class="cups">${cups}</div><h3>Medaglie</h3><div class="records">${medals}</div>
    <h3>Record personali</h3><div class="records">${recs}</div><h3>Obiettivi</h3><div class="ach">${ach}</div>
    <h3>Sorprese da sbloccare</h3><div class="ach">${cel}${kits}</div>`;
}

// ---------------- impostazioni ----------------
function renderSettings() {
  const s = S();
  const toggles = [['music', 'Musica'], ['sfx', 'Effetti sonori'], ['voice', 'Telecronaca (voce)'], ['crowd', 'Pubblico e cori'], ['assisted', 'Modalità assistita (consigliata)']];
  const st = Store.get();
  $('#settingsBody').innerHTML = toggles.map(([k, l]) => `<div class="set-row"><span>${l}</span><button class="switch ${s[k] ? 'on' : ''}" data-k="${k}" aria-label="${l}"></button></div>`).join('') +
    `<h3>Difficoltà</h3><div class="chips" id="setDiff"></div>
     <h3>Grafica</h3><div class="chips" id="setQ"></div>
     <h3>Esultanza dopo il gol</h3><div class="chips" id="setCel"></div>
     <h3>Durata partita</h3><div class="chips" id="setDur"></div>
     <h3>Per i genitori</h3>
     <div class="parents">Nessuna pubblicità, nessun acquisto, nessuna registrazione, nessun dato raccolto. I progressi restano solo su questo dispositivo.
       Per installare il gioco: su iPhone apri il menu Condividi di Safari e scegli “Aggiungi alla schermata Home”; su Android apri il menu di Chrome e scegli “Installa app”.
       Dopo la prima apertura il gioco funziona anche senza internet.</div>
     <div class="cta-row"><button class="btn-soft" id="btnReset">Tieni premuto per azzerare i progressi</button></div>`;
  $$('#settingsBody .switch').forEach(b => b.onclick = () => {
    const k = b.dataset.k; Store.setSetting(k, !S()[k]); b.classList.toggle('on', S()[k]);
    Audio.applySettings(); Audio.sfx('click');
    if (k === 'music') { if (S().music) Audio.musicStart(); }
  });
  chips($('#setDiff'), DIFFS, s.difficulty, v => Store.setSetting('difficulty', v));
  chips($('#setQ'), [{ v: 'alta', label: 'Alta' }, { v: 'media', label: 'Media' }, { v: 'bassa', label: 'Risparmio batteria' }], s.quality, v => { Store.setSetting('quality', v); recreateRenderer(); });
  chips($('#setCel'), Store.CELEBRATIONS.map(c => ({ v: c.id, label: c.name, locked: st.stars < c.stars, lockMsg: `Servono ${c.stars} stelle!` })), s.celebration, v => Store.setSetting('celebration', v));
  chips($('#setDur'), DURS, s.duration, v => Store.setSetting('duration', v));
  holdButton($('#btnReset'), () => { Store.reset(); toast('Progressi azzerati'); renderSettings(); }, 3000);
}

// ---------------- motore 3D ----------------
let renderer = null, game = null, gameCtx = null;
function getRenderer() {
  if (renderer) return renderer;
  const canvas = $('#gl');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: S().quality !== 'bassa', powerPreference: S().quality === 'alta' ? 'high-performance' : 'default' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}
function recreateRenderer() {
  if (game || !renderer) return;
  renderer.dispose();
  const old = $('#gl'), c = document.createElement('canvas'); c.id = 'gl';
  old.replaceWith(c);
  renderer = null;
}

// HUD condiviso
const hud = {
  score(h, a) { $('#sbScore').textContent = a == null ? `${h}` : `${h} - ${a}`; },
  clock(t) { $('#sbClock').textContent = t; },
  banner(text, ms = 1800, cls = '') {
    const b = $('#banner'); b.className = 'banner ' + cls; b.textContent = text;
    requestAnimationFrame(() => b.classList.add('show'));
    clearTimeout(hud._bt); hud._bt = setTimeout(() => b.classList.remove('show'), ms);
  },
  comment(text) { const c = $('#comment'); c.textContent = text; c.classList.add('show'); clearTimeout(hud._ct); hud._ct = setTimeout(() => c.classList.remove('show'), 2600); },
  hint(text) { const h = $('#hint'); h.textContent = text; h.classList.toggle('on', !!text); },
  power(v) { const p = $('#power'); p.classList.toggle('on', v > 0); $('#powerFill').style.height = (v * 100) + '%'; },
  labels(has) {
    if (hud._has === has) return; hud._has = has;
    $('#btnShoot span').textContent = has ? 'TIRA' : 'RUBA';
  },
  replay(on) { $('#replayTag').classList.toggle('on', on); },
  pens(res, max) {
    const p = $('#pens'); p.classList.add('on');
    const row = (arr, name) => { let d = ''; const n = Math.max(max, arr.length); for (let i = 0; i < n; i++) d += `<span class="dot ${arr[i] === true ? 'y' : arr[i] === false ? 'n' : ''}"></span>`; return `<div class="row"><b>${name}</b>${d}</div>`; };
    p.innerHTML = row(res[0], 'TU') + (gameCtx && gameCtx.practice ? '' : row(res[1], 'CPU'));
    const a = res[0].filter(Boolean).length, b = res[1].filter(Boolean).length;
    hud.score(a, gameCtx && gameCtx.practice ? null : b);
  },
  diveButtons(on) { $('#dive').classList.toggle('on', on); },
  mode(m) { const g = $('#scr-game'); g.classList.remove('mode-shoot', 'mode-dive', 'mode-train'); if (m) g.classList.add('mode-' + m); },
  end(result) { onGameEnd(result); }
};

function baseOpts(homeId, awayId, stadiumId) {
  const st = Store.get();
  const home = Teams.team(homeId), away = Teams.team(awayId);
  const kitChoice = homeId === st.favoriteTeam ? st.kit : 'home';
  return {
    home, away, kits: Teams.resolveKits(home, away, kitChoice), stadium: Teams.stadium(stadiumId),
    rosters: [Teams.roster(home, true), Teams.roster(away, false)],
    difficulty: S().difficulty, assisted: S().assisted, quality: S().quality, celebration: S().celebration, duration: S().duration
  };
}

function enterGameScreen(ctx) {
  Audio.musicStop();
  resetInput();
  hud._has = null;
  $('#pens').classList.remove('on'); hud.hint(''); hud.diveButtons(false); hud.replay(false); hud.power(0);
  $('#banner').classList.remove('show'); $('#comment').classList.remove('show');
  hud.mode(ctx.kind === 'penalty' ? 'shoot' : ctx.kind === 'training' ? 'train' : null);
  $('#sbHome').textContent = ctx.opts.home.short;
  $('#sbAway').textContent = ctx.kind === 'match' ? ctx.opts.away.short : '';
  $('#sbAway').style.display = ctx.kind === 'match' ? '' : 'none';
  $('#sbClock').textContent = ctx.kind === 'match' ? "0'" : '';
  show('game', false);
  $('#gl').style.display = 'block';
  tryFullscreen();
  checkRotate();
  if (matchMedia('(pointer: fine)').matches) {
    const msg = ctx.kind === 'penalty' ? 'Mouse: punta la porta, tieni premuto il tasto sinistro e lascia per tirare'
      : 'Mouse: Andrea corre verso il puntatore. Clic sinistro = TIRA, clic destro = PASSA';
    setTimeout(() => { if (game) { hud.hint(msg); setTimeout(() => { if (game && $('#hint').textContent === msg) hud.hint(''); }, 6000); } }, ctx.kind === 'match' ? 3000 : 2300);
  }
}

function startMatch({ mode, home, away, stadium }) {
  const opts = baseOpts(home, away, stadium);
  gameCtx = { kind: 'match', mode, opts };
  enterGameScreen(gameCtx);
  game = new MatchGame(getRenderer(), opts, hud);
  game.start();
}
function startPenalty({ practice = false } = {}) {
  const fav = Store.get().favoriteTeam;
  const opts = baseOpts(fav, practice ? randomOpponent(fav) : penOpp || randomOpponent(fav), 'stelle');
  opts.practice = practice;
  gameCtx = { kind: 'penalty', practice, opts };
  enterGameScreen(gameCtx);
  game = new PenaltyGame(getRenderer(), opts, hud);
  game.start();
}
function startTraining(drill) {
  const fav = Store.get().favoriteTeam;
  const opts = baseOpts(fav, randomOpponent(fav), 'campioni');
  opts.drill = drill;
  gameCtx = { kind: 'training', drill, opts };
  enterGameScreen(gameCtx);
  game = new TrainingGame(getRenderer(), opts, hud);
  game.start();
}

function stopGame() {
  if (game) { game.dispose(); game = null; }
  Audio.stopVoice();
  $('#gl').style.display = 'none';
  $('#ovPause').classList.remove('on'); $('#ovResult').classList.remove('on'); $('#ovRotate').classList.remove('on');
  hud.diveButtons(false);
}

// ---------------- fine partita e premi ----------------
const ENCOURAGE_LOSS = ['Hai giocato benissimo! La prossima la vinci tu!', 'Bravo Andrea! I campioni non mollano mai!', 'Che grinta! Riprova, sei fortissimo!'];
function starsHtml(n) { return `<div class="earned">${Array.from({ length: Math.min(n, 8) }, (_, i) => `<span class="star-ico" style="animation-delay:${i * 0.12}s"></span>`).join('')}</div>`; }

function onGameEnd(r) {
  const ctx = gameCtx;
  let html = '', stars = 0, news = [];
  const card = $('#resultCard');
  if (ctx.kind === 'match') {
    const rec = Store.recordMatch(r.gf, r.ga, ctx.mode);
    stars = rec.stars; news = rec.news;
    const h = ctx.opts.home, a = ctx.opts.away;
    const title = r.gf > r.ga ? 'HAI VINTO!' : r.gf === r.ga ? 'PAREGGIO!' : 'BRAVO LO STESSO!';
    const msg = r.gf > r.ga ? 'Sei un vero campione, Andrea!' : r.gf === r.ga ? 'Che partita combattuta!' : ENCOURAGE_LOSS[Math.floor(Math.random() * 3)];
    let extra = '';
    if (ctx.mode === 'league') {
      const lr = League.recordUserResult(r.gf, r.ga);
      extra = `<p>Classifica: <b>${lr.position}° posto</b></p>`;
      if (lr.finished) {
        if (lr.position === 1) { Store.winCup('scudetto'); Store.unlock('campione'); extra += '<p><b>CAMPIONE D\'ITALIA! Hai vinto lo Scudetto!</b></p>'; Audio.say('Andrea è campione d\'Italia! Hai vinto lo scudetto!'); }
        else extra += `<p>Campionato finito al ${lr.position}° posto. Bravissimo!</p>`;
        const bonus = lr.position === 1 ? 10 : lr.position <= 4 ? 5 : 3;
        news = news.concat(Store.addStars(bonus)); stars += bonus;
      }
    }
    html = `<h2>${title}</h2><div class="big-score">${Teams.badgeSVG(h, 60)} ${r.gf} - ${r.ga} ${Teams.badgeSVG(a, 60)}</div><p>${msg}</p>${extra}`;
  } else if (ctx.kind === 'penalty') {
    const rr = Store.get().records;
    rr.penaltiesScored += r.gf; rr.penaltiesSaved += r.saves;
    if (r.saves > 0) Store.unlock('rigore_parato');
    if (r.gf > 0) Store.unlock('primo_gol');
    if (!r.practice && r.won) { rr.shootoutsWon++; Store.unlock('serie_rigori'); Store.winCup('coppa_rigori'); }
    stars = r.practice ? 1 + Math.floor(r.gf / 3) : r.won ? 3 : 1;
    if (r.practice) {
      const medal = medalFor('rigori', r.gf);
      Store.setMedal('rigori', medal, r.gf);
      checkTrainingCups();
      html = `<h2>${r.gf} gol su ${r.kicks}!</h2>${medal ? `<span class="medal ${medal}"><i></i>Medaglia di ${medal}</span>` : ''}<p>${r.gf >= 5 ? 'Che bomber!' : 'Bravo! Continua ad allenarti!'}</p>`;
    } else {
      html = `<h2>${r.won ? 'HAI VINTO AI RIGORI!' : 'BRAVO LO STESSO!'}</h2><div class="big-score">${r.gf} - ${r.ga}</div><p>${r.won ? 'Sei il re dei rigori!' : 'Una bella sfida! Riprova!'}${r.saves ? ` Hai parato ${r.saves} rigor${r.saves > 1 ? 'i' : 'e'}!` : ''}</p>`;
    }
    news = Store.addStars(stars);
  } else {
    const d = DRILLS.find(x => x.id === r.drill);
    Store.setMedal(r.drill, r.medal, r.score, !!d.lower);
    checkTrainingCups();
    stars = r.medal === 'oro' ? 3 : r.medal === 'argento' ? 2 : 1;
    news = Store.addStars(stars);
    html = `<h2>${d.name}</h2><div class="big-score">${r.score} <small style="font-size:24px">${d.unit}</small></div>
      ${r.medal ? `<span class="medal ${r.medal}"><i></i>Medaglia di ${r.medal}</span>` : '<p>Continua così, la medaglia è vicina!</p>'}`;
  }
  news = news.concat(Store.takeNews());
  Store.save();
  html += `<p>Hai guadagnato ${stars} stell${stars === 1 ? 'a' : 'e'}!</p>${starsHtml(stars)}`;
  if (news.length) html += `<div class="row">${news.map(n => `<div class="news">${n}</div>`).join('')}</div>`;
  html += `<div class="row"><button class="btn-go" id="btnAgain">${ctx.kind === 'match' && ctx.mode === 'league' ? 'CONTINUA' : 'GIOCA ANCORA'}</button><button class="btn-soft" id="btnToMenu">Menu</button></div>`;
  card.innerHTML = html;
  $('#ovResult').classList.add('on');
  Audio.sfx('win');
  $('#btnAgain').onclick = () => {
    Audio.sfx('big'); stopGame();
    if (ctx.kind === 'match' && ctx.mode === 'league') { show('league', false); Audio.musicStart(); }
    else if (ctx.kind === 'match') startMatch({ mode: ctx.mode, home: ctx.opts.home.id, away: ctx.mode === 'quick' ? ctx.opts.away.id : randomOpponent(ctx.opts.home.id), stadium: ctx.opts.stadium.id });
    else if (ctx.kind === 'penalty') startPenalty({ practice: ctx.practice });
    else startTraining(ctx.drill);
  };
  $('#btnToMenu').onclick = () => { Audio.sfx('click'); stopGame(); show('menu', false); };
}

function checkTrainingCups() {
  const m = Store.get().medals;
  if (DRILLS.every(d => m[d.id])) { Store.unlock('allenato'); if (!Store.get().trophies.coppa_allenamento) Store.winCup('coppa_allenamento'); }
  if (DRILLS.every(d => m[d.id] === 'oro')) Store.unlock('tutto_oro');
}

// ---------------- schermo intero, orientamento, pausa ----------------
function tryFullscreen() {
  const el = document.documentElement;
  try {
    if (!document.fullscreenElement && el.requestFullscreen && !matchMedia('(display-mode: standalone)').matches) el.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
    else screen.orientation?.lock?.('landscape').catch(() => {});
  } catch (e) {}
}
let rotateDismissed = false;
function checkRotate() {
  const portrait = window.innerHeight > window.innerWidth * 1.05;
  $('#ovRotate').classList.toggle('on', !!game && portrait && !rotateDismissed && current === 'game');
}
window.addEventListener('resize', checkRotate);

function pauseGame(v) {
  if (!game) return;
  game.pause(v);
  $('#ovPause').classList.toggle('on', v);
  if (v) Audio.stopVoice();
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { Audio.suspend(); if (game && !$('#ovResult').classList.contains('on')) pauseGame(true); }
  else Audio.resume();
});

// ---------------- avvio ----------------
async function boot() {
  Audio.unlockOnGesture();
  $$('.ico').forEach(i => { const k = [...i.classList].find(c => c.startsWith('ico-')); if (k) i.innerHTML = ICONS[k.slice(4)] || ''; });
  $('#mascotBig').innerHTML = mascotSVG();
  $('#mascotSmall').innerHTML = mascotSVG();
  setupControls($('#scr-game'));
  try { await Teams.loadTeams(); }
  catch (e) { $('.loading-text').textContent = 'Errore nel caricamento delle squadre. Riprova.'; return; }
  const st = Store.get();
  if (!Teams.teams().find(t => t.id === st.favoriteTeam)) st.favoriteTeam = Teams.teams()[0].id;
  // benvenuto
  show('welcome', false);
  const first = !st.firstRunDone;
  const wb = $('#welcomeBubble');
  wb.innerHTML = first ? WELCOME_HTML : 'Ciao <b>Andrea</b>! Bentornato nel tuo stadio! Sei pronto a giocare?';
  $('#mascotBig').classList.add('talking'); setTimeout(() => $('#mascotBig').classList.remove('talking'), 5000);
  // al primo tocco (necessario per l'audio sui telefoni) parte la voce e la musica
  const greet = () => {
    window.removeEventListener('pointerdown', greet);
    Audio.init(); Audio.musicStart();
    if (current === 'welcome') speak($('#mascotBig'), wb, first ? WELCOME_TEXT : 'Ciao Andrea! Bentornato nel tuo stadio! Sei pronto a giocare?', wb.innerHTML);
  };
  window.addEventListener('pointerdown', greet);
  $('#btnPlay').onclick = () => {
    Audio.init(); Audio.sfx('big'); Audio.musicStart();
    st.firstRunDone = true; Store.save();
    tryFullscreen();
    show('menu', false);
  };
  // menu
  $$('.mbtn').forEach(b => b.onclick = () => {
    Audio.sfx('click');
    const go = b.dataset.go;
    if (go === 'playnow') {
      const fav = Store.get().favoriteTeam;
      const stads = Teams.stadiums();
      startMatch({ mode: 'quick', home: fav, away: randomOpponent(fav), stadium: stads[Math.floor(Math.random() * stads.length)].id });
    } else show(go);
  });
  $$('[data-back]').forEach(b => b.onclick = back);
  $('#btnQuickGo').onclick = () => { Audio.sfx('big'); startMatch({ mode: 'quick', home: quick.home, away: quick.away, stadium: quick.stadium }); };
  $('#btnPenGo').onclick = () => { Audio.sfx('big'); startPenalty({ practice: false }); };
  $('#btnPause').onclick = () => { Audio.sfx('click'); pauseGame(true); };
  $('#btnResume').onclick = () => { Audio.sfx('click'); pauseGame(false); };
  $('#btnQuit').onclick = () => { Audio.sfx('click'); stopGame(); show('menu', false); };
  $('#btnRotateOk').onclick = () => { rotateDismissed = true; checkRotate(); };
  $$('#dive button').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); game && game.chooseDive && game.chooseDive(Number(b.dataset.dive)); }));
  // tocco sul campo durante il replay = salta
  $('#joyZone').addEventListener('pointerdown', () => { if (game && game.skipReplay && game.phase === 'replay') game.skipReplay(); });
  $('#gl').style.display = 'none';
}

// service worker: funzionamento offline
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// accesso per i test automatici
window.__afc = { get game() { return game; }, input, Store, startMatch, startPenalty, startTraining, show, League };

boot();
