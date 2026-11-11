import { ACESFilmicToneMapping, Clock, PCFSoftShadowMap, PerspectiveCamera, Plane, Raycaster, Scene, SRGBColorSpace, Vector2, Vector3, WebGLRenderer } from 'three';
import { CameraDirector } from '../camera/CameraDirector';
import { Stadium } from './Stadium';
import { getStadium } from './themes';

/** Motore di gioco: renderer WebGL, scena, telecamera, ciclo principale */
export class Engine {
  renderer: WebGLRenderer;
  scene = new Scene();
  camera: PerspectiveCamera;
  director: CameraDirector;
  stadium: Stadium;
  clock = new Clock();
  time = 0;
  private raf = 0;
  private updaters = new Set<(dt: number, t: number) => void>();
  private ray = new Raycaster();
  private ground = new Plane(new Vector3(0, 1, 0), 0);
  timeScale = 1;
  fps = 60;
  private fpsAcc = 0; private fpsN = 0;

  constructor(public canvas: HTMLCanvasElement, stadiumId: string, public quality: 'alta' | 'media') {
    this.renderer = new WebGLRenderer({ canvas, antialias: quality === 'alta', powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'alta' ? 2 : 1.5));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.camera = new PerspectiveCamera(50, 1, 0.1, 900);
    this.director = new CameraDirector(this.camera);
    this.stadium = new Stadium(this.scene, getStadium(stadiumId), quality);
    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', this.resize);
    this.loop();
  }

  setStadium(id: string) {
    if (this.stadium.theme.id === id) return;
    this.stadium.dispose();
    this.stadium = new Stadium(this.scene, getStadium(id), this.quality);
  }

  resize = () => {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // in verticale (iPhone in mano) allarghiamo il campo visivo
    this.camera.fov = w < h ? 68 : 50;
    this.camera.updateProjectionMatrix();
  };

  onUpdate(fn: (dt: number, t: number) => void) { this.updaters.add(fn); return () => { this.updaters.delete(fn); }; }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const raw = Math.min(this.clock.getDelta(), 1 / 20);
    this.fpsAcc += raw; this.fpsN++;
    if (this.fpsAcc > 1) { this.fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; }
    const dt = raw * this.timeScale;
    this.time += dt;
    this.updaters.forEach((u) => u(dt, this.time));
    this.director.update(raw);
    this.stadium.update(dt, this.time);
    this.renderer.render(this.scene, this.camera);
  };

  /** Coordinate schermo (px) → punto sul terreno */
  screenToGround(x: number, y: number): Vector3 | null {
    const r = this.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), this.camera);
    const out = new Vector3();
    return this.ray.ray.intersectPlane(this.ground, out);
  }

  /** Coordinate schermo → punto su un piano verticale x = X (piano della porta) */
  screenToPlaneX(x: number, y: number, X: number): Vector3 | null {
    const r = this.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), this.camera);
    const out = new Vector3();
    return this.ray.ray.intersectPlane(new Plane(new Vector3(1, 0, 0), -X), out);
  }

  worldToScreen(p: Vector3): { x: number; y: number; visible: boolean } {
    const v = p.clone().project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height, visible: v.z < 1 };
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
  }
}
