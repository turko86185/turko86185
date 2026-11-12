// Passaggio con il dito che va oltre il compagno, gesto molto veloce: deve arrivare al compagno
import { createRequire } from 'module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage(); page.setDefaultTimeout(120000);
const cdp = await ctx.newCDPSession(page);
await page.goto('http://localhost:4173/');
for (const lvl of [1, 2, 6]) {
  const lv = Object.fromEntries(Array.from({ length: lvl - 1 }, (_, i) => [i + 1, { stars: 3, tries: 1 }]));
  await page.evaluate((lv) => localStorage.setItem('andrea-football-champions-v1', JSON.stringify({ version: 1, welcomed: true, teamId: 'inter', levels: lv, trophies: [], settings: { sfx: false, music: false, voice: false, quality: 'media', difficulty: 'medio' } })), lv);
  await page.reload();
  await page.tap('[data-testid=splash]');
  await page.tap('[data-testid=menu-play]');
  await page.waitForFunction(() => window.__afc?.match?.state === 'aim', null, { timeout: 60000 });
  await page.waitForTimeout(400);
  const pts = await page.evaluate(() => {
    const { match, engine } = window.__afc; const V = match.ball.pos.constructor;
    const tm = match.attackers[1].pos, bp = match.ball.pos;
    const over = new V(tm.x + (tm.x - bp.x) * 0.25, 0, tm.z + (tm.z - bp.z) * 0.25); // 25% oltre il compagno
    const a = engine.worldToScreen(bp), b = engine.worldToScreen(over);
    return Array.from({ length: 6 }, (_, i) => ({ x: a.x + (b.x - a.x) * i / 5, y: a.y + (b.y - a.y) * i / 5 }));
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pts[0]] });
  for (const p of pts.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p] }); // velocissimo
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(200);
  const plan = await page.evaluate(() => { const p = window.__afc.lastPlan; return p && { type: p.type, v0: Math.hypot(p.v0.x, p.v0.z).toFixed(1), vEnd: Math.hypot(p.v0.x + p.a.x * p.T, p.v0.z + p.a.z * p.T).toFixed(1), recv: p.receiverId }; });
  const ok = await page.waitForFunction(() => document.querySelector('[data-testid=result]') || window.__afc.match.passes > 0 || /Bel passaggio|Bravo|Ottimo|Perfetto/.test(document.querySelector('[data-testid=banner]')?.textContent || ''), null, { timeout: 60000 }).then(() => true).catch(() => false);
  console.log(`livello ${lvl}:`, JSON.stringify(plan), ok ? '✅ passaggio ricevuto' : '❌ non ricevuto');
}
await browser.close();
