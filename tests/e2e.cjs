// Test end-to-end nel browser (Playwright).
// Uso: python3 -m http.server 8765 -d docs  &&  node tests/e2e.cjs [cartella-screenshot]
const { chromium, devices } = require('playwright');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'http://localhost:8765/';
const SHOTS = process.argv[2] || null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }); };

const errors = [];
const watch = (page) => {
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
};

async function deckOf(page) { return page.evaluate(() => window.__memoryKids.game.engine.deck); }
async function tapCard(page, i) { await page.click(`#board .card[data-i="${i}"]`); }

async function solve(page, { mistakes = 0 } = {}) {
  const deck = await deckOf(page);
  const pairs = {};
  deck.forEach((s, i) => (pairs[s] ??= []).push(i));
  const list = Object.values(pairs);
  for (let k = 0; k < mistakes; k++) {
    await tapCard(page, list[0][0]); await tapCard(page, list[1][0]);
    await page.waitForTimeout(1300);
  }
  for (const [a, b] of list) {
    await page.waitForFunction(() => !window.__memoryKids.game.engine.locked);
    await tapCard(page, a); await tapCard(page, b);
    await page.waitForTimeout(80);
  }
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  watch(page);
  await page.goto(BASE);
  await shot(page, '01-splash');

  // splash -> home
  await page.click('#btn-start', { force: true });
  await page.waitForSelector('#screen-home.active');
  await page.waitForTimeout(600);
  await shot(page, '02-home');

  // home -> modalità -> livelli
  await page.click('#screen-home [data-go="modes"]');
  await page.waitForSelector('#screen-modes.active');
  assert.equal(await page.locator('.mode-card').count(), 5, '5 modalità');
  await page.waitForTimeout(500);
  await shot(page, '03-modes');
  await page.click('.mode-card >> nth=0');
  await page.waitForSelector('#screen-levels.active');
  assert.equal(await page.locator('.level-btn').count(), 7);
  assert.equal(await page.locator('.level-btn.locked').count(), 6, 'solo il livello 1 è aperto');
  await page.waitForTimeout(500);
  await shot(page, '04-levels');

  // livello bloccato non si apre
  await page.click('.level-btn >> nth=1');
  await page.waitForTimeout(200);
  assert.ok(await page.locator('#screen-levels.active').count(), 'livello bloccato resta chiuso');

  await page.click('.level-btn >> nth=0');
  await page.waitForSelector('#screen-categories.active');
  assert.equal(await page.locator('.cat-btn').count(), 13, '12 categorie + sorpresa');
  await page.waitForTimeout(500);
  await shot(page, '05-categories');
  await page.click('.cat-btn >> nth=1'); // Animali
  await page.waitForSelector('#screen-game.active');
  await page.waitForTimeout(700);
  assert.equal(await page.locator('#board .card').count(), 6);

  // non più di due carte
  const deck = await deckOf(page);
  const firstSym = deck[0];
  const other = deck.findIndex((s) => s !== firstSym);
  const third = deck.findIndex((s, i) => i !== 0 && i !== other && s !== firstSym && s !== deck[other]);
  await tapCard(page, 0); await tapCard(page, other); await tapCard(page, third);
  assert.equal(await page.locator('#board .card.up').count(), 2, 'massimo due carte scoperte');
  assert.equal(await page.textContent('#hud-moves b'), '1', 'una mossa');
  await page.waitForTimeout(250);
  await shot(page, '06-game-mismatch');
  await page.waitForTimeout(1100);
  assert.equal(await page.locator('#board .card.up').count(), 0, 'le carte sbagliate si rigirano');

  // una coppia resta scoperta
  const mate = deck.findIndex((s, i) => i !== 0 && s === firstSym);
  await tapCard(page, 0); await tapCard(page, mate);
  await page.waitForTimeout(600);
  assert.equal(await page.locator('#board .card.done').count(), 2, 'coppia trovata resta scoperta');
  assert.equal(await page.textContent('#hud-moves b'), '2');
  assert.equal(await page.textContent('#hud-pairs b'), '1/3');
  await shot(page, '07-game-match');

  // salvataggio automatico partita in corso -> ricarica -> continua
  await page.reload();
  await page.click('#btn-start', { force: true });
  await page.waitForSelector('#screen-home.active');
  assert.ok(await page.locator('#btn-continue:not(.hidden)').count(), 'pulsante Continua visibile');
  await page.click('#btn-continue');
  await page.waitForSelector('#screen-game.active');
  await page.waitForTimeout(700);
  assert.equal(await page.locator('#board .card.done').count(), 2, 'partita ripresa con coppia trovata');
  assert.equal(await page.textContent('#hud-moves b'), '2');

  // pausa
  await page.click('#btn-pause');
  assert.equal(await page.isVisible('#overlay-pause'), true);
  await shot(page, '08-pause');
  const t1 = await page.evaluate(() => window.__memoryKids.game.elapsed);
  await page.waitForTimeout(1200);
  const t2 = await page.evaluate(() => window.__memoryKids.game.elapsed);
  assert.ok(Math.abs(t2 - t1) < 0.01, 'il tempo si ferma in pausa');
  await page.click('#btn-resume');

  // finire la partita
  await solve(page);
  await page.waitForSelector('#overlay-win:not([hidden])', { timeout: 5000 });
  await page.waitForTimeout(2200);
  await shot(page, '09-win');
  const prog = await page.evaluate(() => window.__memoryKids.progress);
  assert.equal(prog.unlocked.level, 2, 'livello 2 sbloccato');
  assert.ok(prog.stars >= 1);
  assert.equal(prog.savedGame, null);

  // Avanti -> livello 2 (8 carte)
  await page.click('#win-buttons .btn >> nth=0');
  await page.waitForTimeout(700);
  assert.equal(await page.locator('#board .card').count(), 8);
  await solve(page, { mistakes: 2 });
  await page.waitForSelector('#overlay-win:not([hidden])', { timeout: 5000 });
  assert.equal(await page.evaluate(() => window.__memoryKids.game.engine.moves), 6);
  await page.click('#win-buttons .btn >> text=Menu');
  await page.waitForSelector('#screen-home.active');

  // progressi persistono dopo ricarica
  await page.reload();
  const prog2 = await page.evaluate(() => window.__memoryKids.progress);
  assert.equal(prog2.unlocked.level, 3, 'progressi salvati dopo ricarica');

  // Modalità Tempo: tempo scaduto -> nessuna penalità, +30 s
  await page.evaluate(() => window.__memoryKids.startGame({ mode: 'time', n: 1, category: 'dolci' }));
  await page.waitForTimeout(500);
  await page.evaluate(() => { window.__memoryKids.game.timeLeft = 0.3; });
  await page.waitForSelector('#overlay-win:not([hidden])', { timeout: 3000 });
  await page.waitForTimeout(400);
  await shot(page, '10-timeup');
  assert.match(await page.textContent('#win-title'), /Tempo/);
  await page.click('#win-buttons .btn >> nth=0'); // +30 s
  await solve(page);
  await page.waitForSelector('#overlay-win:not([hidden])', { timeout: 5000 });
  await page.click('#win-buttons .btn >> text=Menu');

  // Sfida con anteprima
  await page.evaluate(() => window.__memoryKids.startGame({ mode: 'challenge', n: 1, category: 'mare' }));
  await page.waitForTimeout(1200);
  assert.equal(await page.locator('#board .card.up').count(), 6, 'anteprima mostra le carte');
  await shot(page, '11-challenge-preview');
  await page.waitForTimeout(3500);
  assert.equal(await page.locator('#board .card.up').count(), 0);
  await solve(page);
  await page.waitForSelector('#overlay-win:not([hidden])', { timeout: 5000 });
  await page.click('#win-buttons .btn >> text=Menu');

  // Super Memory 40 carte -> tutte visibili senza scroll
  await page.evaluate(() => { const p = window.__memoryKids.progress; p.unlocked.super = 4; });
  await page.evaluate(() => window.__memoryKids.startGame({ mode: 'super', n: 4, category: 'mix' }));
  await page.waitForTimeout(1500);
  const fits = await page.evaluate(() => [...document.querySelectorAll('#board .card')].every((c) => { const r = c.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; }));
  assert.ok(fits, '40 carte entrano nello schermo');
  await shot(page, '12-super40');
  await page.click('#btn-pause'); await page.click('#btn-pause-home');

  // schermate premi / temi / statistiche / impostazioni / installa
  for (const s of ['awards', 'themes', 'stats', 'settings', 'install']) {
    await page.evaluate((id) => window.__memoryKids.show(id), s);
    await page.waitForTimeout(450);
    await shot(page, `13-${s}`);
  }

  // offline: service worker attivo -> ricarica senza rete
  await page.goto(BASE);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(800);
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForSelector('#btn-start');
  await page.click('#btn-start', { force: true });
  await page.waitForSelector('#screen-home.active');
  await page.evaluate(() => window.__memoryKids.startGame({ mode: 'relax', n: 1, category: 'spazio' }));
  await page.waitForTimeout(600);
  assert.equal(await page.locator('#board .card').count(), 6, 'gioco funzionante offline');
  await ctx.setOffline(false);

  // responsive: tablet e orizzontale, nessuno scroll orizzontale
  for (const [name, dev] of [['ipad', devices['iPad (gen 7)']], ['android', devices['Pixel 7']], ['landscape', devices['iPhone 13 landscape']], ['small', { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
    const c = await browser.newContext({ ...dev });
    const p = await c.newPage(); watch(p);
    await p.goto(BASE);
    await p.click('#btn-start', { force: true });
    await p.waitForSelector('#screen-home.active');
    await p.waitForTimeout(500);
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false, `nessuno scroll orizzontale (${name})`);
    await shot(p, `20-${name}-home`);
    await p.evaluate(() => window.__memoryKids.startGame({ mode: 'classic', n: 1, category: 'principesse' }));
    await p.evaluate(() => { window.__memoryKids.progress.unlocked.level = 7; });
    await p.evaluate(() => window.__memoryKids.startGame({ mode: 'classic', n: 7, category: 'frutta' }));
    await p.waitForTimeout(1400);
    const fit = await p.evaluate(() => [...document.querySelectorAll('#board .card')].every((el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1; }));
    assert.ok(fit, `30 carte visibili (${name})`);
    await shot(p, `21-${name}-game30`);
    await c.close();
  }

  await browser.close();
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log('E2E OK ✅');
})().catch((e) => { console.error(e); console.error(errors.join('\n')); process.exit(1); });
