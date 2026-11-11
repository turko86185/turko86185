// Screenshot in verticale (iPhone tenuto in mano) di menu, livello e cross/testa
import { createRequire } from 'module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto('http://localhost:4173/');
const lv = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [i + 1, { stars: 2, tries: 1 }]));
await page.evaluate((lv) => localStorage.setItem('andrea-football-champions-v1', JSON.stringify({ version: 1, welcomed: true, teamId: 'napoli', stadiumId: 'stelle', levels: lv, trophies: ['primo-gol'] })), lv);
await page.reload();
await page.tap('[data-testid=splash]');
await page.waitForTimeout(800);
await page.screenshot({ path: 'e2e/shots/p1-menu.png' });
await page.tap('[data-testid=menu-play]'); // livello 17 = cross e testa
await page.waitForFunction(() => window.__afc?.match?.state === 'aim', null, { timeout: 20000 });
await page.waitForTimeout(600);
await page.screenshot({ path: 'e2e/shots/p2-level17.png' });
console.log(await page.textContent('[data-testid=objective]'));
const cdp = await ctx.newCDPSession(page);
const pts = await page.evaluate(() => {
  const { match, engine } = window.__afc; const a = engine.worldToScreen(match.ball.pos); const b = engine.worldToScreen(match.attackers[1].pos);
  return Array.from({ length: 12 }, (_, i) => ({ x: a.x + (b.x - a.x) * i / 11, y: a.y + (b.y - a.y) * i / 11 }));
});
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pts[0]] });
for (const p of pts.slice(1)) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p] }); await page.waitForTimeout(16); }
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
console.log('plan', await page.evaluate(() => window.__afc.lastPlan?.type));
await page.waitForFunction(() => /TESTA/.test(document.querySelector('[data-testid=banner]')?.textContent || '') || window.__afc.match.state === 'outcome', null, { timeout: 25000 });
await page.waitForTimeout(500);
await page.screenshot({ path: 'e2e/shots/p3-header.png' });
console.log('banner', await page.textContent('[data-testid=banner]').catch(() => ''), await page.evaluate(() => window.__afc.match.state));
await browser.close();
