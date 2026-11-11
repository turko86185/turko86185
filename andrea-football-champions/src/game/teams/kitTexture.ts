import { CanvasTexture, SRGBColorSpace } from 'three';
import type { Kit } from './teams';

const cache = new Map<string, CanvasTexture>();

/** Disegna una maglia originale (nessun marchio ufficiale) con il motivo della squadra e il numero. */
export function drawKit(ctx: CanvasRenderingContext2D, kit: Kit, w: number, h: number, number?: number) {
  ctx.fillStyle = kit.primary;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = kit.secondary;
  switch (kit.pattern) {
    case 'stripes': {
      const n = 5;
      for (let i = 0; i < n; i++) if (i % 2 === 1) ctx.fillRect((i * w) / n, 0, w / n, h);
      break;
    }
    case 'halves':
      ctx.fillRect(w / 2, 0, w / 2, h);
      break;
    case 'hoops':
      for (let i = 0; i < 6; i++) if (i % 2) ctx.fillRect(0, (i * h) / 6, w, h / 6);
      break;
    case 'sash':
      ctx.beginPath();
      ctx.moveTo(0, h * 0.1); ctx.lineTo(w * 0.25, 0); ctx.lineTo(w, h * 0.75); ctx.lineTo(w * 0.75, h); ctx.closePath(); ctx.fill();
      break;
    case 'cross':
      ctx.fillRect(w * 0.42, 0, w * 0.16, h);
      ctx.fillRect(0, h * 0.3, w, h * 0.14);
      break;
    case 'band':
      ctx.fillRect(0, h * 0.38, w, h * 0.16);
      break;
    default:
      ctx.fillRect(0, 0, w, h * 0.07); // colletto
  }
  if (number !== undefined) {
    ctx.fillStyle = kit.number;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = w * 0.02;
    ctx.font = `bold ${Math.round(h * 0.42)}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(String(number), w / 2, h * 0.55);
    ctx.fillText(String(number), w / 2, h * 0.55);
  }
}

export function kitTexture(kit: Kit, number?: number): CanvasTexture {
  const key = JSON.stringify(kit) + number;
  const c = cache.get(key);
  if (c) return c;
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  drawKit(canvas.getContext('2d')!, kit, 128, 128, number);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}
