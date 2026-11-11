// Genera le icone PNG della PWA dall'SVG usando il Chromium preinstallato
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync, writeFileSync } from 'fs';
const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, pad] of [['icon-192', 192, 0], ['icon-512', 512, 0], ['icon-512-maskable', 512, 0.1], ['apple-touch-icon', 180, 0]]) {
  await page.setViewportSize({ width: size, height: size });
  const inner = Math.round(size * (1 - pad * 2));
  await page.setContent(`<html><body style="margin:0;background:#0b2a4a;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</body></html>`);
  const buf = await page.screenshot({ type: 'png' });
  writeFileSync(new URL(`../public/icons/${name}.png`, import.meta.url), buf);
}
await browser.close();
console.log('icone create');
