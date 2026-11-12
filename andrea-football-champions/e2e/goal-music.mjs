// Nel gioco vero: al GOL e alla PARATA di Andrea deve suonare la musica (misura del segnale sul canale musiche)
import { createRequire } from 'module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage(); page.setDefaultTimeout(120000);
const cdp = await ctx.newCDPSession(page);
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:4173/');
const swipe = async (target) => {
  const pts = await page.evaluate((t) => { const { match, engine } = window.__afc; const V = match.ball.pos.constructor; const a = engine.worldToScreen(match.ball.pos), b = engine.worldToScreen(new V(...t)); return Array.from({ length: 12 }, (_, i) => ({ x: a.x + (b.x - a.x) * i / 11, y: a.y + (b.y - a.y) * i / 11 })); }, target);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pts[0]] });
  for (const p of pts.slice(1)) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p] }); await page.waitForTimeout(20); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};
const tapMusicProbe = () => page.evaluate(() => {
  const A = window.__afc.audio;
  const an = A.ctx.createAnalyser(); an.fftSize = 1024; A.jingleGain.connect(an);
  window.__peak = 0; const buf = new Float32Array(1024);
  window.__probe = setInterval(() => { an.getFloatTimeDomainData(buf); for (const v of buf) window.__peak = Math.max(window.__peak, Math.abs(v)); }, 25);
});
// 1) GOL nel livello 3 (porta senza portiere)
await page.evaluate(() => localStorage.setItem('andrea-football-champions-v1', JSON.stringify({ version: 1, welcomed: true, teamId: 'milan', levels: { 1: { stars: 3, tries: 1 }, 2: { stars: 3, tries: 1 } }, trophies: [], settings: { sfx: true, music: true, voice: true, quality: 'media', difficulty: 'facile' } })));
await page.reload();
await page.tap('[data-testid=splash]');
await page.tap('[data-testid=menu-play]');
await page.waitForFunction(() => window.__afc?.match?.state === 'aim', null, { timeout: 60000 });
await tapMusicProbe();
await swipe([52.5, 1, 0.5]);
await page.waitForFunction(() => /GOO/.test(document.querySelector('[data-testid=banner]')?.textContent || ''), null, { timeout: 60000 });
await page.waitForTimeout(1500);
console.log('GOL → picco musica:', await page.evaluate(() => window.__peak.toFixed(3)));
// 2) PARATA di Andrea ai rigori (forziamo la direzione giusta)
await page.goto('http://localhost:4173/');
await page.tap('[data-testid=splash]');
await page.tap('[data-testid=menu-penalties]');
await page.tap('[data-testid=opp-ok]');
await page.waitForFunction(() => window.__afc?.match?.state === 'aim', null, { timeout: 60000 });
await swipe([52.5, 0.8, -2.5]);
await page.waitForFunction(() => window.__afc?.match?.cfg.mode === 'penaltyDefend' && window.__afc.match.state === 'aim', null, { timeout: 90000 });
await tapMusicProbe();
// rendiamo certa la parata per il test
await page.evaluate(() => { const m = window.__afc.match; const orig = m.keeperAI.onShot.bind(m.keeperAI); m.keeperAI.onShot = (p) => { orig(p, () => 0); m.keeperAI.willSave = true; }; });
await page.tap('.keeper-btns button:nth-child(2)');
const b = await page.waitForFunction(() => { const t = document.querySelector('[data-testid=banner]')?.textContent || ''; return /PARATA|Gol/.test(t) ? t : null; }, null, { timeout: 60000 }).then((h) => h.jsonValue());
await page.waitForTimeout(1500);
console.log(b, '→ picco musica:', await page.evaluate(() => window.__peak.toFixed(3)));
console.log('errori:', errs);
await browser.close();
