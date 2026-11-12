import { createRequire } from 'module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:4173/');
// salvataggio "vecchio" senza difficoltà: deve partire da Facile
await page.evaluate(() => localStorage.setItem('andrea-football-champions-v1', JSON.stringify({ version: 1, welcomed: true, teamId: 'roma', levels: { 1: { stars: 3, tries: 1 }, 2: { stars: 3, tries: 1 }, 3: { stars: 3, tries: 1 }, 4: { stars: 3, tries: 1 } }, trophies: [], settings: { sfx: true, music: true, voice: true, quality: 'alta' } })));
await page.reload();
await page.tap('[data-testid=splash]');
await page.waitForSelector('[data-testid=difficulty]');
const def = await page.evaluate(() => JSON.parse(localStorage.getItem('andrea-football-champions-v1')).settings.difficulty ?? 'facile(default)');
console.log('predefinita:', def, '| pulsante attivo:', await page.getAttribute('[data-testid=diff-facile]', 'class'));
await page.screenshot({ path: 'e2e/shots/d1-menu.png' });
const kd = {};
for (const lvl of ['facile', 'medio', 'difficile']) {
  await page.tap(`[data-testid=diff-${lvl}]`);
  await page.tap('[data-testid=menu-play]'); // livello 5 con portiere
  await page.waitForFunction(() => window.__afc?.match?.state === 'aim', null, { timeout: 20000 });
  kd[lvl] = await page.evaluate(() => ({ diff: +window.__afc.match.cfg.difficulty.toFixed(3), assist: +window.__afc.match.cfg.assist.toFixed(2), keeper: +window.__afc.match.keeperAI.difficulty.toFixed(3) }));
  await page.tap('button[aria-label=Pausa]');
  await page.tap('text=Torna al menu');
  await page.waitForSelector('[data-testid=difficulty]');
}
console.log(JSON.stringify(kd));
console.log('salvata:', await page.evaluate(() => JSON.parse(localStorage.getItem('andrea-football-champions-v1')).settings.difficulty));
console.log('errori:', errs);
await browser.close();
