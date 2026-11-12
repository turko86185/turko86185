// Verifica che le musiche di gol/parata/vittoria producano davvero suono (analisi del segnale)
import { createRequire } from 'module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage(); page.setDefaultTimeout(120000);
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:4173/');
await page.evaluate(() => localStorage.setItem('andrea-football-champions-v1', JSON.stringify({ version: 1, welcomed: true, teamId: 'napoli', levels: {}, trophies: [], settings: { sfx: false, music: true, voice: false, quality: 'media', difficulty: 'facile' } })));
await page.reload();
await page.tap('[data-testid=splash]');
await page.tap('[data-testid=menu-play]');
await page.waitForFunction(() => window.__afc?.audio?.ctx, null, { timeout: 60000 });
const measure = (name, music) => page.evaluate(async ([name, music]) => {
  const A = window.__afc.audio;
  A.setSettings({ sfx: false, music, voice: false });
  A.stopMusic();
  const an = A.ctx.createAnalyser(); an.fftSize = 2048; A.master.connect(an);
  await new Promise((r) => setTimeout(r, 300));
  A.jingle(name);
  const buf = new Float32Array(2048); let peak = 0;
  const end = performance.now() + 1500;
  while (performance.now() < end) { an.getFloatTimeDomainData(buf); for (const v of buf) peak = Math.max(peak, Math.abs(v)); await new Promise((r) => setTimeout(r, 30)); }
  A.master.disconnect(an);
  return +peak.toFixed(3);
}, [name, music]);
for (const n of ['goal', 'save', 'win', 'cup', 'ohno']) console.log(n, 'musica SI → picco', await measure(n, true), '| musica NO → picco', await measure(n, false));
console.log('errori', errs);
await browser.close();
