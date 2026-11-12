// Screenshot della grafica in verticale: mira, freccia di anteprima, volo, folla
import { createRequire } from 'module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto('http://localhost:4173/');
const lvl = Number(process.env.LVL || 41);
const lv = Object.fromEntries(Array.from({ length: lvl - 1 }, (_, i) => [i + 1, { stars: 2, tries: 1 }]));
await page.evaluate(([lv, st]) => localStorage.setItem('andrea-football-champions-v1', JSON.stringify({ version: 1, welcomed: true, teamId: 'roma', stadiumId: st, levels: lv, trophies: [], settings: { sfx: false, music: false, voice: false, quality: 'alta', difficulty: 'medio' } })), [lv, process.env.ST || 'sole']);
await page.reload();
await page.tap('[data-testid=splash]');
await page.tap('[data-testid=menu-play]');
await page.waitForFunction(() => window.__afc?.match?.state === 'aim', null, { timeout: 30000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'e2e/shots/look-1-aim.png' });
// anteprima: trascina verso il primo compagno (o la porta) senza rilasciare
const cdp = await ctx.newCDPSession(page);
const pts = await page.evaluate((shoot) => {
  const process_target = (match, V) => shoot || !match.attackers[1] ? new V(52.5, 0.9, match.keeper && match.keeper.pos.z > 0 ? -2.6 : 2.6) : match.attackers[1].pos;
  const { match, engine } = window.__afc; const V = match.ball.pos.constructor;
  const a = engine.worldToScreen(match.ball.pos);
  const b = engine.worldToScreen(process_target(match, V));
  return Array.from({ length: 14 }, (_, i) => ({ x: a.x + (b.x - a.x) * i / 13, y: a.y + (b.y - a.y) * i / 13 }));
}, !!process.env.SHOOT);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pts[0]] });
for (const p of pts.slice(1)) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p] }); await page.waitForTimeout(60); }
await page.waitForTimeout(300);
console.log('preview', await page.evaluate(() => { const m = window.__afc.match; return [!!m.preview, m.state, m.canDraw]; }));
await page.screenshot({ path: 'e2e/shots/look-2-preview.png' });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await page.waitForTimeout(900);
await page.screenshot({ path: 'e2e/shots/look-3-flight.png' });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'e2e/shots/look-4-after.png' });
console.log('fps', await page.evaluate(() => window.__afc.engine.fps));
await browser.close();
