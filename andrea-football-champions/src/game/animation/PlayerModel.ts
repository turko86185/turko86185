import {
  BoxGeometry, CapsuleGeometry, Group, Mesh, MeshLambertMaterial, MeshStandardMaterial, SphereGeometry, CylinderGeometry, Material, Object3D
} from 'three';
import type { Kit } from '../teams/teams';
import { kitTexture } from '../teams/kitTexture';

const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#f5cba7'];
const HAIRS = ['#2c1b0f', '#5a3825', '#0f0f0f', '#d4a456', '#8b4513', '#3b2a1a'];

const geo = {
  torso: new BoxGeometry(0.26, 0.56, 0.44),
  head: new SphereGeometry(0.135, 16, 12),
  hair: new SphereGeometry(0.142, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
  eye: new SphereGeometry(0.022, 8, 6),
  upperArm: new CapsuleGeometry(0.055, 0.2, 4, 8),
  foreArm: new CapsuleGeometry(0.045, 0.2, 4, 8),
  hand: new SphereGeometry(0.05, 8, 6),
  thigh: new CapsuleGeometry(0.085, 0.28, 4, 8),
  shin: new CapsuleGeometry(0.065, 0.3, 4, 8),
  boot: new BoxGeometry(0.24, 0.08, 0.11),
  shorts: new BoxGeometry(0.27, 0.2, 0.42),
  neck: new CylinderGeometry(0.05, 0.06, 0.08, 8),
  glove: new SphereGeometry(0.07, 8, 6)
};

const matCache = new Map<string, Material>();
function lambert(color: string): Material {
  const k = 'l' + color;
  if (!matCache.has(k)) matCache.set(k, new MeshLambertMaterial({ color }));
  return matCache.get(k)!;
}

export interface Joints {
  root: Group; // posizione sul campo, rotazione = direzione
  body: Group; // bacino (salti, inclinazioni, tuffi)
  spine: Group;
  head: Group;
  shoulderL: Group; shoulderR: Group;
  elbowL: Group; elbowR: Group;
  hipL: Group; hipR: Group;
  kneeL: Group; kneeR: Group;
}

function mesh(g: any, m: Material, parent: Object3D, x = 0, y = 0, z = 0, cast = true) {
  const me = new Mesh(g, m);
  me.position.set(x, y, z);
  me.castShadow = cast;
  parent.add(me);
  return me;
}

/**
 * Calciatore 3D procedurale (originale), avanti = +X locale, lato = Z.
 * Le articolazioni sono gruppi ruotati dall'Animator.
 */
export function buildPlayer(kit: Kit, number: number, seed: number, isKeeper = false): Joints {
  const skin = lambert(SKINS[seed % SKINS.length]);
  const hair = lambert(HAIRS[(seed * 7) % HAIRS.length]);
  const shirt = new MeshStandardMaterial({ map: kitTexture(kit, number), roughness: 0.8 });
  const sleeve = lambert(kit.primary);
  const shorts = lambert(kit.shorts);
  const socks = lambert(kit.socks);
  const boots = lambert(isKeeper ? '#222' : ['#111', '#e74c3c', '#f1c40f', '#ffffff', '#2980b9'][seed % 5]);

  const root = new Group();
  const body = new Group(); body.position.y = 0.95; root.add(body);
  mesh(geo.shorts, shorts, body, 0, 0.02, 0);
  const spine = new Group(); spine.position.y = 0.1; body.add(spine);
  mesh(geo.torso, shirt, spine, 0, 0.28, 0);
  mesh(geo.neck, skin, spine, 0, 0.6, 0);
  const head = new Group(); head.position.y = 0.72; spine.add(head);
  mesh(geo.head, skin, head, 0, 0.02, 0);
  const h = mesh(geo.hair, hair, head, -0.01, 0.04, 0); h.rotation.z = 0.15;
  const eyeM = lambert('#1b1b1b');
  mesh(geo.eye, eyeM, head, 0.12, 0.04, 0.05, false);
  mesh(geo.eye, eyeM, head, 0.12, 0.04, -0.05, false);

  const mkArm = (side: number) => {
    const sh = new Group(); sh.position.set(0, 0.5, side * 0.27); spine.add(sh);
    mesh(geo.upperArm, sleeve, sh, 0, -0.14, 0);
    const el = new Group(); el.position.y = -0.29; sh.add(el);
    mesh(geo.foreArm, isKeeper ? sleeve : skin, el, 0, -0.13, 0);
    mesh(isKeeper ? geo.glove : geo.hand, isKeeper ? lambert('#f5f5f5') : skin, el, 0, -0.28, 0);
    return [sh, el];
  };
  const [shoulderL, elbowL] = mkArm(-1);
  const [shoulderR, elbowR] = mkArm(1);

  const mkLeg = (side: number) => {
    const hip = new Group(); hip.position.set(0, -0.05, side * 0.11); body.add(hip);
    mesh(geo.thigh, skin, hip, 0, -0.2, 0);
    const kn = new Group(); kn.position.y = -0.43; hip.add(kn);
    mesh(geo.shin, socks, kn, 0, -0.2, 0);
    mesh(geo.boot, boots, kn, 0.05, -0.43, 0);
    return [hip, kn];
  };
  const [hipL, kneeL] = mkLeg(-1);
  const [hipR, kneeR] = mkLeg(1);

  return { root, body, spine, head, shoulderL, shoulderR, elbowL, elbowR, hipL, hipR, kneeL, kneeR };
}
