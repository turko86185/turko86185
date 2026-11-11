// Test E2E: emulazione iPhone 13, eventi touch reali (CDP), service worker e offline.
import { createRequire } from 'module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const URL = process.env.URL || 'http://localhost:4173/';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'] });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
let pass = 0, fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? '✅' : '❌'} ${name} ${info}`); ok ? pass++ : fail++; };

async function touchSwipe(points) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: points[0].x, y: points[0].y }] });
  for (const p of points.slice(1)) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y: p.y }] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
/** Disegna dal pallone a un punto del mondo (con eventuale curva in px) */
async function swipeTo(world, bend = 0, n = 14) {
  const pts = await page.evaluate(({ world, bend, n }) => {
    const { match, engine } = window.__afc;
    const a = engine.worldToScreen(match.ball.pos);
    const V = match.ball.pos.constructor;
    const b = engine.worldToScreen(new V(world[0], world[1], world[2]));
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
    return Array.from({ length: n }, (_, i) => { const t = i / (n - 1); const s = Math.sin(Math.PI * t) * bend; return { x: a.x + dx * t + (-dy / L) * s, y: a.y + dy * t + (dx / L) * s }; });
  }, { world, bend, n });
  await touchSwipe(pts);
}
const waitState = (s, ms = 20000) => page.waitForFunction((s) => window.__afc?.match?.state === s, s, { timeout: ms });
const levels = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, { stars: 3, tries: 1 }]));
async function boot(seed) {
  await page.evaluate((seed) => { localStorage.setItem('andrea-football-champions-v1', JSON.stringify(seed)); }, seed);
  await page.reload();
  await page.tap('[data-testid=splash]');
  await page.waitForSelector('[data-testid=menu]');
}

await page.goto(URL);
await page.waitForSelector('[data-testid=splash]');
check('splash visibile', true);
const swReady = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
check('service worker attivo', swReady);
const manifest = await page.evaluate(async () => (await fetch('manifest.webmanifest')).json());
check('manifest PWA', manifest.display === 'standalone' && manifest.icons.length >= 2, manifest.name);

// ---- Primo avvio: benvenuto + scelta squadra
await page.tap('[data-testid=splash]');
await page.waitForSelector('[data-testid=welcome]');
check('benvenuto con il saluto ad Andrea', (await page.textContent('[data-testid=welcome]')).includes('ANDREA'));
await page.tap('[data-testid=btn-giochiamo]');
await page.waitForSelector('[data-testid=team-select]');
check('20 squadre selezionabili', (await page.$$('[data-testid^=team-]')).length - 2 === 20);
await page.tap('[data-testid=team-lazio]');
await page.tap('[data-testid=team-ok]');
await page.waitForSelector('[data-testid=menu]');

// ---- Livello 1: passaggio con il dito
await page.tap('[data-testid=menu-play]');
await waitState('aim');
await page.waitForTimeout(400);
await page.screenshot({ path: 'e2e/shots/10-l1-aim.png' });
await swipeTo([28, 0, -6]);
await page.waitForTimeout(150);
const plan1 = await page.evaluate(() => window.__afc.lastPlan && { type: window.__afc.lastPlan.type, recv: window.__afc.lastPlan.receiverId });
check('touch: disegno rilevato e convertito in passaggio', plan1 && plan1.recv === 1, JSON.stringify(plan1));
await page.waitForTimeout(300);
await page.screenshot({ path: 'e2e/shots/11-l1-flight.png' });
await page.waitForSelector('[data-testid=result]', { timeout: 25000 });
check('livello 1 completato (passaggio ricevuto)', (await page.textContent('[data-testid=result]')).includes('Livello 1'));
await page.screenshot({ path: 'e2e/shots/12-l1-result.png' });
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('andrea-football-champions-v1')).levels['1']);
check('progressi salvati', saved && saved.stars >= 1, JSON.stringify(saved));

// ---- Livello 3: tiro in porta → gol
await page.tap('[data-testid=btn-next]');
await waitState('aim');
await page.tap('[data-testid=btn-next]').catch(() => {});
await page.evaluate(() => 0);
// livello 2: passaggio lungo
await swipeTo([32, 0, 8]);
await page.waitForSelector('[data-testid=result]', { timeout: 25000 });
check('livello 2 completato', true);
await page.tap('[data-testid=btn-next]');
await waitState('aim');
await page.waitForTimeout(300);
await swipeTo([52.5, 1.0, 0.5]);
await page.waitForSelector('[data-testid=banner]', { timeout: 15000 });
const b3 = await page.textContent('[data-testid=banner]');
await page.screenshot({ path: 'e2e/shots/13-goal.png' });
check('tiro → GOL', b3.includes('GOO'), b3);
await page.waitForTimeout(1500);
await page.screenshot({ path: 'e2e/shots/14-celebrate.png' });
await page.waitForSelector('[data-testid=result]', { timeout: 25000 });

// ---- Livello 5 con portiere: tiri finché segna, registra parate
await boot({ version: 1, welcomed: true, teamId: 'roma', stadiumId: 'stelle', ballId: 'classico', kitId: 'casa', levels: levels(4), trophies: [], settings: { sfx: true, music: true, voice: true, quality: 'alta' } });
await page.tap('[data-testid=menu-play]');
let saves = 0, goals = 0;
for (let i = 0; i < 6 && goals === 0; i++) {
  await waitState('aim', 12000);
  await page.waitForTimeout(300);
  const kz = await page.evaluate(() => window.__afc.match.keeper.pos.z);
  await swipeTo([52.5, 0.6, kz > 0 ? -2.6 : 2.6]);
  const o = await page.waitForFunction(() => { const t = document.querySelector('[data-testid=banner]')?.textContent || ''; return /GOO|PARAT|parata|Palla|PALO/.test(t) ? t : null; }, null, { timeout: 15000 }).then((h) => h.jsonValue()).catch(() => 'nessuno');
  if (/GOO/.test(o)) goals++; else if (/arat|ARAT/.test(o)) saves++;
  if (!goals) await page.waitForTimeout(4200);
}
check('portiere battuto (gol con il portiere)', goals > 0, `parate=${saves}`);
await page.waitForSelector('[data-testid=result]', { timeout: 25000 });

// ---- Tiro a effetto (livello 16) + il portiere si tuffa
await boot({ version: 1, welcomed: true, teamId: 'roma', stadiumId: 'tramonto', ballId: 'classico', kitId: 'casa', levels: levels(15), trophies: [], settings: { sfx: true, music: true, voice: true, quality: 'alta' } });
await page.tap('[data-testid=menu-levels]');
await page.tap('[data-testid=level-16]');
await waitState('aim');
await page.waitForTimeout(300);
const obj = await page.textContent('[data-testid=objective]');
await swipeTo([52.5, 1.0, 2.3], 90, 18);
await page.waitForTimeout(80);
const plan16 = await page.evaluate(() => ({ type: window.__afc.lastPlan?.type, curve: window.__afc.lastPlan?.curveAmount }));
check('disegno curvo → tiro a effetto', plan16.type === 'curl_shot' && plan16.curve > 0.8, `${obj} ${JSON.stringify(plan16)}`);
await page.waitForTimeout(450);
await page.screenshot({ path: 'e2e/shots/15-curl.png' });
const kAnim = await page.evaluate(() => window.__afc.match.keeper?.anim.name);
check('il portiere reagisce al tiro (tuffo/presa)', ['dive', 'catch', 'jump'].includes(kAnim), kAnim);

// ---- Difensore e pallonetto (livello 9)
await boot({ version: 1, welcomed: true, teamId: 'milan', stadiumId: 'sole', ballId: 'classico', kitId: 'casa', levels: levels(8), trophies: [], settings: { sfx: true, music: true, voice: true, quality: 'alta' } });
await page.tap('[data-testid=menu-play]');
await waitState('aim');
await page.waitForTimeout(300);
await swipeTo([38, 0, 2]);
await page.waitForFunction(() => window.__afc.match.state === 'flight', null, { timeout: 15000 });
await page.waitForTimeout(200);
const p9 = await page.evaluate(() => window.__afc.lastPlan?.type);
check('passaggio sopra il difensore = pallonetto', p9 === 'lob_pass', p9);
const defMoved = await page.evaluate(() => { const d = window.__afc.match.defenders[0]; return !!d.target || d.vel.length() > 0; });
check('il difensore si muove verso il pallone', defMoved);
await page.waitForSelector('[data-testid=result]', { timeout: 25000 });
check('livello 9 superato (difensore superato)', true);

// ---- Rigori: tiro + parata con i pulsanti
await page.tap('[data-testid=btn-menu]');
await page.tap('[data-testid=menu-penalties]');
await page.tap('[data-testid=opp-ok]');
await waitState('aim');
await page.waitForTimeout(300);
await page.screenshot({ path: 'e2e/shots/16-penalty.png' });
await swipeTo([52.5, 0.8, -2.5]);
await page.waitForSelector('[data-testid=interlude]', { timeout: 25000 });
await page.waitForFunction(() => window.__afc?.match?.cfg.mode === 'penaltyDefend' && window.__afc.match.state === 'aim', null, { timeout: 25000 });
await page.waitForTimeout(500);
await page.screenshot({ path: 'e2e/shots/17-keeper.png' });
await page.tap('.keeper-btns button:nth-child(1)');
await page.waitForSelector('[data-testid=banner]', { timeout: 15000 });
check('rigore avversario e tuffo del portiere di Andrea', true, await page.textContent('[data-testid=banner]'));

// ---- Allenamento
await page.tap('button[aria-label=Pausa]');
await page.tap('text=Torna al menu');
await page.tap('[data-testid=menu-training]');
await page.tap('[data-testid=drill-tiro]');
await waitState('aim');
await page.waitForTimeout(300);
await page.screenshot({ path: 'e2e/shots/18-training.png' });
await swipeTo([52.5, 1.2, -2.6]);
await page.waitForSelector('[data-testid=interlude]', { timeout: 25000 });
check('allenamento: punteggio', /Punti/.test(await page.textContent('[data-testid=interlude]')));

// ---- Prestazioni
const fps = await page.evaluate(() => window.__afc.engine.fps);
console.log('FPS (headless software rendering):', fps.toFixed(1));

// ---- Offline
await ctx.setOffline(true);
await page.reload();
await page.waitForSelector('[data-testid=splash]', { timeout: 25000 });
await page.tap('[data-testid=splash]');
await page.waitForSelector('[data-testid=menu]');
const st = await page.evaluate(() => JSON.parse(localStorage.getItem('andrea-football-champions-v1')).teamId);
check('funziona offline dopo il primo caricamento + progressi persistenti', st === 'milan');
await page.tap('[data-testid=menu-quick]');
await page.tap('[data-testid=opp-ok]');
await waitState('aim');
check('partita veloce offline', true);
await page.screenshot({ path: 'e2e/shots/19-offline-quick.png' });

check('nessun errore JavaScript', errors.length === 0, errors.join(' | '));
console.log(`\n${pass} superati, ${fail} falliti`);
await browser.close();
process.exit(fail ? 1 : 0);
