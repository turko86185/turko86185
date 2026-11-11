import { CanvasTexture, Mesh, MeshStandardMaterial, SphereGeometry, SRGBColorSpace, Quaternion, Vector3, Group, CircleGeometry, MeshBasicMaterial } from 'three';
import { BALL_R } from '../physics/constants';
import type { BallSkin } from '../save/rewards';

export function ballTexture(skin: BallSkin): CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 256;
  const c = cv.getContext('2d')!;
  const [a, b] = skin.colors;
  c.fillStyle = a; c.fillRect(0, 0, 512, 256);
  const hexagon = (x: number, y: number, r: number, fill: string) => {
    c.fillStyle = fill; c.beginPath();
    for (let i = 0; i < 5; i++) { const t = (i / 5) * Math.PI * 2 - Math.PI / 2; c.lineTo(x + Math.cos(t) * r, y + Math.sin(t) * r); }
    c.closePath(); c.fill();
  };
  switch (skin.pattern) {
    case 'classico':
    case 'oro': {
      const pts = [[64, 128], [192, 128], [320, 128], [448, 128], [0, 40], [128, 40], [256, 40], [384, 40], [512, 40], [0, 216], [128, 216], [256, 216], [384, 216], [512, 216]];
      for (const [x, y] of pts) hexagon(x, y, y === 128 ? 34 : 24, b);
      c.strokeStyle = skin.pattern === 'oro' ? '#a07c10' : 'rgba(0,0,0,0.25)'; c.lineWidth = 2;
      for (let x = 0; x < 512; x += 64) { c.beginPath(); c.moveTo(x, 70); c.lineTo(x + 32, 128); c.lineTo(x, 186); c.stroke(); }
      if (skin.pattern === 'oro') { c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(0, 0, 512, 60); }
      break;
    }
    case 'righe':
      skin.colors.forEach((col, i) => { c.fillStyle = col; c.fillRect(0, (i * 256) / skin.colors.length, 512, 256 / skin.colors.length + 1); });
      break;
    case 'stelle':
      for (let i = 0; i < 26; i++) {
        const x = Math.random() * 512, y = 30 + Math.random() * 196, r = 10 + Math.random() * 12;
        c.fillStyle = b; c.beginPath();
        for (let k = 0; k < 10; k++) { const t = (k / 10) * Math.PI * 2; const rr = k % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(t) * rr, y + Math.sin(t) * rr); }
        c.closePath(); c.fill();
      }
      break;
    case 'fuoco': {
      const g = c.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, b); g.addColorStop(0.5, a); g.addColorStop(1, '#8b0000');
      c.fillStyle = g; c.fillRect(0, 0, 512, 256);
      c.fillStyle = 'rgba(255,255,180,0.6)';
      for (let x = 0; x < 512; x += 40) { c.beginPath(); c.moveTo(x, 200); c.quadraticCurveTo(x + 20, 60, x + 40, 200); c.fill(); }
      break;
    }
  }
  const t = new CanvasTexture(cv);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Pallone 3D con rotazione realistica e ombra a terra */
export class BallMesh {
  group = new Group();
  mesh: Mesh;
  shadow: Mesh;
  private q = new Quaternion();
  constructor(skin: BallSkin) {
    this.mesh = new Mesh(new SphereGeometry(BALL_R, 24, 16), new MeshStandardMaterial({ map: ballTexture(skin), roughness: 0.45, metalness: skin.pattern === 'oro' ? 0.6 : 0 }));
    this.mesh.castShadow = true;
    this.shadow = new Mesh(new CircleGeometry(BALL_R * 1.2, 16), new MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.35, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.group.add(this.mesh, this.shadow);
  }
  setSkin(skin: BallSkin) {
    const m = this.mesh.material as MeshStandardMaterial;
    m.map?.dispose(); m.map = ballTexture(skin); m.metalness = skin.pattern === 'oro' ? 0.6 : 0; m.needsUpdate = true;
  }
  update(pos: Vector3, axis: Vector3, rate: number, dt: number) {
    this.mesh.position.copy(pos);
    if (rate > 0.01) {
      this.q.setFromAxisAngle(axis, -rate * dt);
      this.mesh.quaternion.premultiply(this.q);
    }
    this.shadow.position.set(pos.x, 0.02, pos.z);
    const h = Math.max(0, pos.y - BALL_R);
    this.shadow.scale.setScalar(1 + h * 0.3);
    (this.shadow.material as MeshBasicMaterial).opacity = Math.max(0.08, 0.35 - h * 0.06);
  }
}
