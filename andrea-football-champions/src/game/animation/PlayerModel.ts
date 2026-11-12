import {
  BoxGeometry, CanvasTexture, CapsuleGeometry, ConeGeometry, CylinderGeometry, Group, LatheGeometry, Material, Mesh,
  MeshStandardMaterial, Object3D, SphereGeometry, SRGBColorSpace, Vector2, BufferGeometry
} from 'three';
import type { Kit } from '../teams/teams';

/**
 * Calciatore 3D originale con proporzioni realistiche (≈1,82 m):
 * busto modellato, maglia con motivo della squadra e numero sulla schiena, calzoncini,
 * calzettoni, scarpini, volto e capigliature diverse.
 * Avanti = +X locale, lato = Z. Le articolazioni sono gruppi animati dall'Animator.
 */
export interface Joints {
  root: Group; body: Group; spine: Group; head: Group;
  shoulderL: Group; shoulderR: Group; elbowL: Group; elbowR: Group;
  hipL: Group; hipR: Group; kneeL: Group; kneeR: Group;
}

const SKINS = ['#f2c9a0', '#e0ac69', '#c68642', '#8d5524', '#f8d5b8', '#d9a066', '#5c3a21', '#a86b3c'];
const HAIRS = ['#1b1209', '#3b2412', '#0d0d0d', '#c9a050', '#6b3a1a', '#2a1a0e', '#e8d6a0', '#ff4fa3', '#3fd0ff', '#ff7a1a'];
type HairStyle = 'short' | 'buzz' | 'mohawk' | 'curly' | 'bun' | 'long';
const STYLES: HairStyle[] = ['short', 'buzz', 'mohawk', 'curly', 'short', 'bun', 'long', 'buzz'];

// ----------------------------------------------------------- geometrie condivise
const SEG = 16;
function limb(rTop: number, rBot: number, len: number) {
  const g = new CylinderGeometry(rTop, rBot, len, SEG, 1, true);
  g.translate(0, -len / 2, 0);
  return g;
}
const torsoProfile = [[0.001, -0.02], [0.15, -0.02], [0.152, 0.06], [0.163, 0.16], [0.185, 0.28], [0.2, 0.38], [0.205, 0.45], [0.19, 0.52], [0.13, 0.575], [0.06, 0.6]].map(([r, y]) => new Vector2(r, y));
const shortsProfile = [[0.001, -0.2], [0.16, -0.2], [0.168, -0.08], [0.163, 0.04], [0.156, 0.1]].map(([r, y]) => new Vector2(r, y));
const G = {
  torso: (() => { const g = new LatheGeometry(torsoProfile, 28); g.scale(0.7, 1, 1); return g; })(),
  shorts: (() => { const g = new LatheGeometry(shortsProfile, 24); g.scale(0.8, 1, 1); return g; })(),
  shortLeg: limb(0.098, 0.092, 0.2),
  thighSkin: limb(0.078, 0.062, 0.26),
  knee: new SphereGeometry(0.06, 12, 10),
  sock: limb(0.058, 0.042, 0.34),
  sockTop: limb(0.06, 0.06, 0.05),
  ankle: new SphereGeometry(0.043, 10, 8),
  boot: (() => { const g = new CapsuleGeometry(0.045, 0.17, 4, 10); g.rotateZ(Math.PI / 2); g.scale(1, 0.8, 1.05); return g; })(),
  sole: new BoxGeometry(0.27, 0.025, 0.095),
  shoulder: new SphereGeometry(0.06, 14, 10),
  sleeve: limb(0.064, 0.055, 0.15),
  upperArm: limb(0.055, 0.047, 0.3),
  elbowJ: new SphereGeometry(0.044, 10, 8),
  foreArm: limb(0.047, 0.036, 0.25),
  hand: (() => { const g = new SphereGeometry(0.045, 10, 8); g.scale(0.7, 1.25, 0.95); return g; })(),
  glove: (() => { const g = new SphereGeometry(0.065, 10, 8); g.scale(0.75, 1.3, 1.05); return g; })(),
  neck: limb(0.052, 0.058, 0.1),
  head: (() => { const g = new SphereGeometry(0.112, 22, 18); g.scale(0.98, 1.14, 0.9); return g; })(),
  jaw: (() => { const g = new SphereGeometry(0.085, 16, 12); g.scale(1.0, 0.75, 0.95); return g; })(),
  nose: (() => { const g = new ConeGeometry(0.017, 0.045, 8); g.rotateZ(-Math.PI / 2); return g; })(),
  ear: (() => { const g = new SphereGeometry(0.026, 8, 6); g.scale(0.5, 1, 0.4); return g; })(),
  eye: new SphereGeometry(0.013, 8, 6),
  brow: new BoxGeometry(0.012, 0.01, 0.04),
  hairCap: (() => { const g = new SphereGeometry(0.12, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5); g.scale(1.02, 1.0, 0.94); return g; })(),
  hairBuzz: (() => { const g = new SphereGeometry(0.116, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.46); g.scale(1, 1.08, 0.92); return g; })(),
  mohawk: (() => { const g = new BoxGeometry(0.2, 0.07, 0.035); return g; })(),
  curl: new SphereGeometry(0.035, 8, 6),
  bun: new SphereGeometry(0.045, 10, 8),
  longHair: (() => { const g = new CapsuleGeometry(0.1, 0.12, 4, 12); g.scale(0.9, 1, 0.95); return g; })(),
  collar: (() => { const g = new CylinderGeometry(0.072, 0.08, 0.035, 18, 1, true); return g; })()
};

// ----------------------------------------------------------- materiali
const mcache = new Map<string, Material>();
function std(color: string, rough = 0.7, extra: Partial<{ metalness: number }> = {}): Material {
  const k = `${color}|${rough}|${extra.metalness ?? 0}`;
  if (!mcache.has(k)) mcache.set(k, new MeshStandardMaterial({ color, roughness: rough, metalness: extra.metalness ?? 0 }));
  return mcache.get(k)!;
}

const shirtCache = new Map<string, MeshStandardMaterial>();
/** Texture della maglia avvolta sul busto: u=0.25 davanti, u=0.75 dietro */
function shirtMaterial(kit: Kit, number: number, keeper: boolean): MeshStandardMaterial {
  const key = JSON.stringify(kit) + number + keeper;
  const hit = shirtCache.get(key);
  if (hit) return hit;
  const W = 512, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  const front = W * 0.25, back = W * 0.75;
  ctx.fillStyle = kit.primary; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = kit.secondary;
  switch (kit.pattern) {
    case 'stripes': for (let i = 0; i < 12; i++) if (i % 2) ctx.fillRect(front - W / 24 + (i * W) / 12, 0, W / 12, H); break;
    case 'halves': ctx.fillRect(front, 0, W / 2, H); break;
    case 'hoops': for (let i = 0; i < 7; i++) if (i % 2) ctx.fillRect(0, (i * H) / 7, W, H / 7); break;
    case 'sash': ctx.save(); ctx.beginPath(); ctx.moveTo(front - 90, H * 0.95); ctx.lineTo(front - 40, H); ctx.lineTo(front + 90, H * 0.15); ctx.lineTo(front + 40, H * 0.1); ctx.fill(); ctx.restore(); break;
    case 'cross': ctx.fillRect(front - 14, 0, 28, H); ctx.fillRect(front - 120, H * 0.32, 240, 24); ctx.fillRect(back - 14, 0, 28, H); break;
    case 'band': ctx.fillRect(0, H * 0.36, W, H * 0.13); break;
    default: break;
  }
  // colletto e fianchi
  ctx.fillStyle = kit.secondary; ctx.fillRect(0, 0, W, 10);
  ctx.fillRect(0, H - 8, W, 8);
  // pieghe del tessuto e ombre laterali (finto ambient occlusion)
  const g = ctx.createLinearGradient(0, 0, W, 0);
  const sideDark = 'rgba(0,0,0,0.22)', mid = 'rgba(255,255,255,0.06)';
  g.addColorStop(0, sideDark); g.addColorStop(0.25, mid); g.addColorStop(0.5, sideDark); g.addColorStop(0.75, mid); g.addColorStop(1, sideDark);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.05})`; ctx.lineWidth = 2 + Math.random() * 3;
    const x = Math.random() * W, y = H * (0.4 + Math.random() * 0.6);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 15, y - 20, x + 30 + Math.random() * 30, y - 10); ctx.stroke();
  }
  // numero sulla schiena e sul petto
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 ${H * 0.42}px "Arial Black", Arial, sans-serif`;
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.strokeText(String(number), back, H * 0.55);
  ctx.fillStyle = kit.number; ctx.fillText(String(number), back, H * 0.55);
  ctx.font = `900 ${H * 0.13}px Arial, sans-serif`;
  ctx.fillText(String(number), front - 28, H * 0.33);
  // piccolo stemma originale sul petto
  ctx.fillStyle = kit.number; ctx.beginPath(); ctx.arc(front + 30, H * 0.32, 11, 0, 7); ctx.fill();
  ctx.fillStyle = kit.primary; ctx.beginPath(); ctx.arc(front + 30, H * 0.32, 6, 0, 7); ctx.fill();
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  const m = new MeshStandardMaterial({ map: t, roughness: keeper ? 0.6 : 0.72, metalness: 0 });
  shirtCache.set(key, m);
  return m;
}

function add(geo: BufferGeometry, mat: Material, parent: Object3D, x = 0, y = 0, z = 0, cast = true) {
  const m = new Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  parent.add(m);
  return m;
}

export function buildPlayer(kit: Kit, number: number, seed: number, isKeeper = false): Joints {
  const skin = std(SKINS[seed % SKINS.length], 0.62);
  const hairCol = HAIRS[(seed * 7 + 3) % HAIRS.length];
  const hair = std(hairCol, 0.85);
  const style = STYLES[(seed * 5 + 1) % STYLES.length];
  const shirt = shirtMaterial(kit, number, isKeeper);
  const sleeveM = std(kit.primary, 0.72);
  const trim = std(kit.secondary, 0.7);
  const shortsM = std(kit.shorts, 0.75);
  const socksM = std(kit.socks, 0.8);
  const bootCol = isKeeper ? '#1a1a1a' : ['#111111', '#e63946', '#ffd60a', '#ffffff', '#00b4d8', '#ff5ec4', '#7cfc00'][seed % 7];
  const bootM = std(bootCol, 0.35, { metalness: 0.15 });
  const soleM = std('#e8e8e8', 0.5);
  const dark = std('#1a1a1a', 0.4);

  const root = new Group();
  const body = new Group(); body.position.y = 0.95; root.add(body);
  // calzoncini (bacino)
  add(G.shorts, shortsM, body, 0, 0.02, 0);
  const spine = new Group(); spine.position.y = 0.1; body.add(spine);
  add(G.torso, shirt, spine, 0, -0.04, 0);
  add(G.collar, trim, spine, 0, 0.555, 0, false);
  add(G.neck, skin, spine, 0, 0.66, 0);
  // testa
  const head = new Group(); head.position.y = 0.72; spine.add(head);
  add(G.head, skin, head, 0, 0.04, 0);
  add(G.jaw, skin, head, 0.012, -0.03, 0);
  add(G.nose, skin, head, 0.108, 0.025, 0, false);
  add(G.ear, skin, head, -0.005, 0.03, 0.1, false);
  add(G.ear, skin, head, -0.005, 0.03, -0.1, false);
  const eyeM = std('#151515', 0.3);
  add(G.eye, eyeM, head, 0.097, 0.055, 0.037, false);
  add(G.eye, eyeM, head, 0.097, 0.055, -0.037, false);
  add(G.brow, hair, head, 0.1, 0.082, 0.037, false);
  add(G.brow, hair, head, 0.1, 0.082, -0.037, false);
  // capelli
  switch (style) {
    case 'short': add(G.hairCap, hair, head, -0.008, 0.06, 0); break;
    case 'buzz': add(G.hairBuzz, hair, head, -0.004, 0.055, 0); break;
    case 'mohawk': {
      add(G.hairBuzz, std('#2a1a0e', 0.9), head, -0.004, 0.05, 0);
      const mh = add(G.mohawk, hair, head, -0.01, 0.175, 0); mh.rotation.z = -0.15;
      break;
    }
    case 'curly': for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; add(G.curl, hair, head, Math.cos(a) * 0.075 - 0.01, 0.14 + Math.sin(i * 1.7) * 0.02, Math.sin(a) * 0.075); } add(G.hairCap, hair, head, -0.008, 0.07, 0); break;
    case 'bun': add(G.hairCap, hair, head, -0.008, 0.06, 0); add(G.bun, hair, head, -0.07, 0.15, 0); break;
    case 'long': add(G.longHair, hair, head, -0.035, 0.02, 0); break;
  }
  // braccia
  const mkArm = (side: number): [Group, Group] => {
    const sh = new Group(); sh.position.set(0, 0.46, side * 0.212); spine.add(sh);
    add(G.shoulder, sleeveM, sh, 0, -0.01, 0);
    add(G.sleeve, isKeeper ? sleeveM : sleeveM, sh, 0, 0, 0);
    add(G.upperArm, isKeeper ? sleeveM : skin, sh, 0, -0.02, 0);
    add(isKeeper ? G.sleeve : G.sleeve, trim, sh, 0, -0.14, 0).scale.set(1.01, 0.08, 1.01);
    const el = new Group(); el.position.y = -0.3; sh.add(el);
    add(G.elbowJ, isKeeper ? sleeveM : skin, el, 0, 0, 0);
    add(G.foreArm, isKeeper ? sleeveM : skin, el, 0, 0, 0);
    if (isKeeper) add(G.glove, std('#f5f5f5', 0.5), el, 0, -0.3, 0);
    else add(G.hand, skin, el, 0, -0.29, 0);
    return [sh, el];
  };
  const [shoulderL, elbowL] = mkArm(-1);
  const [shoulderR, elbowR] = mkArm(1);
  // gambe
  const mkLeg = (side: number): [Group, Group] => {
    const hip = new Group(); hip.position.set(0, -0.05, side * 0.1); body.add(hip);
    add(G.shortLeg, shortsM, hip, 0, 0.02, 0);
    add(G.thighSkin, skin, hip, 0, -0.17, 0);
    const kn = new Group(); kn.position.y = -0.43; hip.add(kn);
    add(G.knee, skin, kn, 0.005, 0, 0);
    add(G.sockTop, trim, kn, 0, -0.05, 0);
    add(G.sock, socksM, kn, 0, -0.08, 0);
    add(G.ankle, socksM, kn, 0, -0.42, 0);
    add(G.boot, bootM, kn, 0.05, -0.44, 0);
    add(G.sole, soleM, kn, 0.05, -0.475, 0, false);
    void dark;
    return [hip, kn];
  };
  const [hipL, kneeL] = mkLeg(-1);
  const [hipR, kneeR] = mkLeg(1);
  return { root, body, spine, head, shoulderL, shoulderR, elbowL, elbowR, hipL, hipR, kneeL, kneeR };
}
