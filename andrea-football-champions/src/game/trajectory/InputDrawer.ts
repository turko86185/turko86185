import { Vector3 } from 'three';
import type { Engine } from '../engine/Engine';
import { GOAL } from '../physics/constants';

export interface DrawResult { path: Vector3[]; goalPoint: Vector3 | null; gestureSpeed: number; screen: { x: number; y: number }[] }

/**
 * Cattura il disegno del dito (touch) o del mouse su un canvas 2D sovrapposto,
 * mostra una scia luminosa e converte i punti in coordinate del campo.
 */
export class InputDrawer {
  private ctx: CanvasRenderingContext2D;
  private pts: { x: number; y: number; t: number }[] = [];
  private drawing = false;
  private pointerId: number | null = null;
  private fade = 0;
  private raf = 0;
  enabled = () => true;
  onDone: (r: DrawResult) => void = () => {};
  onStart: () => void = () => {};
  onMove: (r: DrawResult) => void = () => {};
  private lastMove = 0;

  constructor(private canvas: HTMLCanvasElement, private engine: Engine) {
    this.ctx = canvas.getContext('2d')!;
    canvas.addEventListener('pointerdown', this.down, { passive: false });
    canvas.addEventListener('pointermove', this.move, { passive: false });
    canvas.addEventListener('pointerup', this.up, { passive: false });
    canvas.addEventListener('pointercancel', this.up, { passive: false });
    // iOS: evita lo scroll/zoom durante il disegno
    canvas.addEventListener('touchstart', this.prevent, { passive: false });
    canvas.addEventListener('touchmove', this.prevent, { passive: false });
    this.resize();
    window.addEventListener('resize', this.resize);
    this.render();
  }

  private prevent = (e: Event) => e.preventDefault();

  resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = this.canvas.clientWidth * dpr;
    this.canvas.height = this.canvas.clientHeight * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  private down = (e: PointerEvent) => {
    e.preventDefault();
    if (!this.enabled() || this.drawing) return;
    this.drawing = true;
    this.pointerId = e.pointerId;
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const r = this.canvas.getBoundingClientRect();
    this.pts = [{ x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }];
    this.fade = 1;
    this.onStart();
  };

  private move = (e: PointerEvent) => {
    if (!this.drawing || e.pointerId !== this.pointerId) return;
    e.preventDefault();
    const r = this.canvas.getBoundingClientRect();
    const last = this.pts[this.pts.length - 1];
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (Math.hypot(x - last.x, y - last.y) >= 4) this.pts.push({ x, y, t: performance.now() });
    const now = performance.now();
    if (now - this.lastMove > 50 && this.pts.length > 2) {
      this.lastMove = now;
      this.onMove(this.toWorld(this.pts.map((p) => ({ x: p.x + r.left, y: p.y + r.top, t: p.t }))));
    }
  };

  private up = (e: PointerEvent) => {
    if (!this.drawing || e.pointerId !== this.pointerId) return;
    this.drawing = false;
    this.pointerId = null;
    const r = this.canvas.getBoundingClientRect();
    const res = this.toWorld(this.pts.map((p) => ({ x: p.x + r.left, y: p.y + r.top, t: p.t })));
    this.onDone(res);
  };

  /** Converte i punti schermo (coordinate client) in punti del campo */
  toWorld(pts: { x: number; y: number; t: number }[]): DrawResult {
    const path: Vector3[] = [];
    for (const p of pts) {
      const g = this.engine.screenToGround(p.x, p.y);
      if (g && Math.abs(g.x) < 80 && Math.abs(g.z) < 60) path.push(g);
    }
    let goalPoint: Vector3 | null = null;
    const last = pts[pts.length - 1];
    if (last) {
      const gp = this.engine.screenToPlaneX(last.x, last.y, GOAL.x);
      const gLast = this.engine.screenToGround(last.x, last.y);
      const groundBeyond = !gLast || gLast.x > GOAL.x - 0.5 || gLast.distanceTo(this.engine.camera.position) > 200;
      if (gp && gp.y > -0.2 && gp.y < GOAL.height + 1.5 && Math.abs(gp.z) < GOAL.halfWidth + 2.5 && (groundBeyond || gp.y > 0.25)) {
        goalPoint = gp.setY(Math.max(0.15, gp.y));
      }
    }
    // velocità del gesto (px/s) sull'ultimo tratto
    let speed = 800;
    if (pts.length > 2) {
      const n = Math.max(0, pts.length - 6);
      const a = pts[n], b = last;
      let L = 0;
      for (let i = n + 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      const dt = Math.max(0.016, (b.t - a.t) / 1000);
      speed = L / dt;
    }
    return { path, goalPoint, gestureSpeed: speed, screen: pts.map((p) => ({ x: p.x, y: p.y })) };
  }

  private render = () => {
    this.raf = requestAnimationFrame(this.render);
    const c = this.ctx;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    c.clearRect(0, 0, w, h);
    if (!this.drawing) this.fade = Math.max(0, this.fade - 0.04);
    if (this.pts.length < 2 || this.fade <= 0) return;
    c.save();
    c.globalAlpha = this.fade;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    const trace = () => {
      c.beginPath();
      c.moveTo(this.pts[0].x, this.pts[0].y);
      for (let i = 1; i < this.pts.length - 1; i++) {
        const mx = (this.pts[i].x + this.pts[i + 1].x) / 2, my = (this.pts[i].y + this.pts[i + 1].y) / 2;
        c.quadraticCurveTo(this.pts[i].x, this.pts[i].y, mx, my);
      }
      const l = this.pts[this.pts.length - 1];
      c.lineTo(l.x, l.y);
    };
    c.shadowColor = 'rgba(255,255,255,0.8)';
    c.shadowBlur = 10;
    c.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    c.lineWidth = 10;
    trace(); c.stroke();
    c.shadowBlur = 4;
    c.strokeStyle = '#ffffff';
    c.lineWidth = 3.5;
    trace(); c.stroke();
    // punta a freccia
    const l = this.pts[this.pts.length - 1];
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.beginPath(); c.arc(l.x, l.y, 7, 0, Math.PI * 2); c.fill();
    c.restore();
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.canvas.removeEventListener('pointerdown', this.down);
    this.canvas.removeEventListener('pointermove', this.move);
    this.canvas.removeEventListener('pointerup', this.up);
    this.canvas.removeEventListener('pointercancel', this.up);
    this.canvas.removeEventListener('touchstart', this.prevent);
    this.canvas.removeEventListener('touchmove', this.prevent);
  }
}
