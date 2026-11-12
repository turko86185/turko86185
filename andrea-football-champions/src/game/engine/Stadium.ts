import {
  AdditiveBlending, BoxGeometry, BufferAttribute, CanvasTexture, Color, CylinderGeometry, DirectionalLight, DoubleSide,
  Group, HemisphereLight, InstancedMesh, Mesh, MeshBasicMaterial, MeshLambertMaterial, MeshStandardMaterial, Object3D,
  PlaneGeometry, Points, PointsMaterial, BufferGeometry, RepeatWrapping, RingGeometry, Scene, ShaderMaterial, SphereGeometry,
  SRGBColorSpace, Sprite, SpriteMaterial, Vector3, Fog
} from 'three';
import { FIELD, GOAL } from '../physics/constants';
import type { StadiumTheme } from './themes';
import { buildGrass, buildBowl, buildFlags, buildLED, buildDetails, type Waving, type CrowdHandle } from './StadiumDetails';

function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new CanvasTexture(cv);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Porta con pali, traversa e rete animata */
export class GoalMesh {
  group = new Group();
  private back: Mesh;
  private basePos: Float32Array;
  private impacts: { y: number; z: number; t: number; amp: number }[] = [];

  constructor(sign: 1 | -1) {
    const postMat = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.3, metalness: 0.1 });
    const r = GOAL.postRadius;
    const postGeo = new CylinderGeometry(r, r, GOAL.height + r, 12);
    for (const z of [-GOAL.halfWidth, GOAL.halfWidth]) {
      const p = new Mesh(postGeo, postMat);
      p.position.set(0, (GOAL.height + r) / 2, z);
      p.castShadow = true;
      this.group.add(p);
    }
    const bar = new Mesh(new CylinderGeometry(r, r, GOAL.halfWidth * 2 + 2 * r, 12), postMat);
    bar.rotation.x = Math.PI / 2;
    bar.position.set(0, GOAL.height, 0);
    bar.castShadow = true;
    this.group.add(bar);
    const netTex = canvasTex(128, 128, (c) => {
      c.clearRect(0, 0, 128, 128);
      c.strokeStyle = 'rgba(255,255,255,0.9)';
      c.lineWidth = 3;
      for (let i = 0; i <= 128; i += 16) {
        c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 128); c.stroke();
        c.beginPath(); c.moveTo(0, i); c.lineTo(128, i); c.stroke();
      }
    });
    netTex.wrapS = netTex.wrapT = RepeatWrapping;
    const mkNet = (w: number, h: number, rx: number, ry: number) => {
      const t = netTex.clone(); t.needsUpdate = true; t.repeat.set(rx, ry);
      return new MeshBasicMaterial({ map: t, transparent: true, side: DoubleSide, alphaTest: 0.2, depthWrite: false });
    };
    // rete posteriore suddivisa per l'animazione
    const backGeo = new PlaneGeometry(GOAL.halfWidth * 2, GOAL.height, 24, 10);
    this.back = new Mesh(backGeo, mkNet(GOAL.halfWidth * 2, GOAL.height, 14, 5));
    this.back.rotation.y = Math.PI / 2;
    this.back.position.set(GOAL.depth, GOAL.height / 2, 0);
    this.group.add(this.back);
    this.basePos = (backGeo.attributes.position.array as Float32Array).slice();
    const side = new PlaneGeometry(GOAL.depth, GOAL.height);
    for (const z of [-GOAL.halfWidth, GOAL.halfWidth]) {
      const m = new Mesh(side, mkNet(GOAL.depth, GOAL.height, 4, 5));
      m.position.set(GOAL.depth / 2, GOAL.height / 2, z);
      this.group.add(m);
    }
    const roof = new Mesh(new PlaneGeometry(GOAL.depth, GOAL.halfWidth * 2), mkNet(GOAL.depth, 7, 4, 14));
    roof.rotation.x = -Math.PI / 2;
    roof.position.set(GOAL.depth / 2, GOAL.height, 0);
    this.group.add(roof);
    this.group.position.x = sign * GOAL.x;
    if (sign < 0) this.group.rotation.y = Math.PI;
  }

  /** Il pallone colpisce la rete: la rete si gonfia e oscilla */
  hit(worldY: number, worldZ: number, speed: number) {
    this.impacts.push({ y: worldY, z: worldZ, t: 0, amp: Math.min(0.9, 0.2 + speed * 0.03) });
  }

  update(dt: number) {
    if (!this.impacts.length) return;
    const pos = this.back.geometry.attributes.position as BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      // coordinate locali del piano: x -> -z mondo (rotazione y=90°), y -> altezza
      const lx = this.basePos[i], ly = this.basePos[i + 1];
      const wz = -lx, wy = ly + GOAL.height / 2;
      let disp = 0;
      for (const im of this.impacts) {
        const d2 = (wz - im.z) ** 2 + (wy - im.y) ** 2;
        disp += im.amp * Math.exp(-d2 / 1.2) * Math.exp(-im.t * 2.5) * Math.cos(im.t * 12);
      }
      arr[i + 2] = this.basePos[i + 2] + disp; // locale z = +x mondo (verso fuori)
    }
    pos.needsUpdate = true;
    for (const im of this.impacts) im.t += dt;
    this.impacts = this.impacts.filter((i) => i.t < 2.5);
  }
}

/** Stadio completo: campo, linee, porte, tribune, pubblico animato, luci, cielo */
export class Stadium {
  group = new Group();
  goal: GoalMesh;
  goal2: GoalMesh;
  crowdMat: ShaderMaterial | MeshLambertMaterial;
  private crowdUniforms = { uTime: { value: 0 }, uExcite: { value: 0 } };
  private snow?: Points;
  private fireworks: { pts: Points; vel: Float32Array; t: number }[] = [];
  sun: DirectionalLight;
  private crowd!: CrowdHandle;
  private flags!: Waving;
  private led!: Waving;

  constructor(private scene: Scene, public theme: StadiumTheme, quality: 'alta' | 'media' = 'alta') {
    scene.background = new Color(theme.skyBottom);
    scene.fog = new Fog(theme.fog, 160, 380);
    this.buildSky();
    this.buildField();
    this.goal = new GoalMesh(1);
    this.goal2 = new GoalMesh(-1);
    this.group.add(this.goal.group, this.goal2.group);
    this.crowd = buildBowl(this.group, theme, quality, ['#ffffff', '#e63946', '#1d3557']);
    this.crowdMat = new MeshLambertMaterial();
    this.flags = buildFlags(this.group, [['#8e1f2f', '#f0bc42'], ['#1a8fd8', '#ffffff'], ['#0a4ea2', '#111111'], ['#c8102e', '#111111'], ['#87c3ea', '#ffffff']]);
    this.led = buildLED(this.group);
    buildDetails(this.group);
    // luci
    const hemi = new HemisphereLight(theme.skyBottom, '#2d5a27', theme.ambient);
    this.group.add(hemi);
    this.sun = new DirectionalLight(theme.sunColor, theme.sunIntensity);
    this.sun.position.set(30, 60, 25);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(quality === 'alta' ? 2048 : 1024, quality === 'alta' ? 2048 : 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.near = 10; sc.far = 140;
    this.sun.shadow.bias = -0.0005;
    this.group.add(this.sun, this.sun.target);
    if (theme.night) this.buildFloodlights();
    if (theme.snow) this.buildSnow();
    scene.add(this.group);
  }

  /** Sposta l'area d'ombra vicino all'azione */
  focus(p: Vector3) {
    this.sun.position.set(p.x + 30, 60, p.z + 25);
    this.sun.target.position.set(p.x, 0, p.z);
  }

  private buildSky() {
    const geo = new SphereGeometry(400, 24, 16);
    const mat = new ShaderMaterial({
      side: 1,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: new Color(this.theme.skyTop) }, bottom: { value: new Color(this.theme.skyBottom) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y*1.6+0.1,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, h),1.0);}'
    });
    this.group.add(new Mesh(geo, mat));
    if (this.theme.night) {
      const n = 600;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const th = Math.random() * Math.PI * 2, ph = Math.random() * 1.2 + 0.15;
        pos.set([Math.cos(th) * Math.cos(ph) * 380, Math.sin(ph) * 380, Math.sin(th) * Math.cos(ph) * 380], i * 3);
      }
      const g = new BufferGeometry(); g.setAttribute('position', new BufferAttribute(pos, 3));
      this.group.add(new Points(g, new PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, fog: false })));
    }
  }

  private buildField() {
    const t = this.theme;
    this.group.add(buildGrass(this.theme));
    // bordo esterno (pista)
    const outer = new Mesh(new PlaneGeometry(260, 200), new MeshLambertMaterial({ color: this.theme.night ? '#1f3d22' : '#3a6b33' }));
    outer.rotation.x = -Math.PI / 2; outer.position.y = -0.02; outer.receiveShadow = true;
    this.group.add(outer);

    const lineMat = new MeshBasicMaterial({ color: '#f4f4f4', polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const W = 0.15, y = 0.02;
    const rect = (cx: number, cz: number, lx: number, lz: number) => {
      const m = new Mesh(new PlaneGeometry(lx, lz), lineMat);
      m.rotation.x = -Math.PI / 2; m.position.set(cx, y, cz);
      this.group.add(m);
    };
    const L = FIELD.halfLength, H = FIELD.halfWidth;
    rect(0, -H, L * 2 + W, W); rect(0, H, L * 2 + W, W);
    rect(-L, 0, W, H * 2); rect(L, 0, W, H * 2); rect(0, 0, W, H * 2);
    for (const s of [-1, 1]) {
      const bx = s * (L - FIELD.boxDepth), sbx = s * (L - FIELD.smallBoxDepth);
      rect(bx, 0, W, FIELD.boxHalfWidth * 2);
      rect(s * (L - FIELD.boxDepth / 2), -FIELD.boxHalfWidth, FIELD.boxDepth, W);
      rect(s * (L - FIELD.boxDepth / 2), FIELD.boxHalfWidth, FIELD.boxDepth, W);
      rect(sbx, 0, W, FIELD.smallBoxHalfWidth * 2);
      rect(s * (L - FIELD.smallBoxDepth / 2), -FIELD.smallBoxHalfWidth, FIELD.smallBoxDepth, W);
      rect(s * (L - FIELD.smallBoxDepth / 2), FIELD.smallBoxHalfWidth, FIELD.smallBoxDepth, W);
      // dischetto
      const spot = new Mesh(new RingGeometry(0, 0.15, 16), lineMat);
      spot.rotation.x = -Math.PI / 2; spot.position.set(s * (L - FIELD.penaltySpot), y, 0);
      this.group.add(spot);
      // lunetta
      const a0 = Math.acos((FIELD.boxDepth - FIELD.penaltySpot) / FIELD.centerRadius);
      const arc = new Mesh(new RingGeometry(FIELD.centerRadius - W / 2, FIELD.centerRadius + W / 2, 48, 1, Math.PI - a0, 2 * a0), lineMat);
      arc.rotation.x = -Math.PI / 2;
      arc.rotation.z = s > 0 ? 0 : Math.PI;
      arc.position.set(s * (L - FIELD.penaltySpot), y, 0);
      this.group.add(arc);
      for (const sz of [-1, 1]) {
        const mid = Math.atan2(sz, -s);
        const c = new Mesh(new RingGeometry(1 - W / 2, 1 + W / 2, 12, 1, mid - Math.PI / 4, Math.PI / 2), lineMat);
        c.rotation.x = -Math.PI / 2;
        c.position.set(s * L, y, sz * H);
        this.group.add(c);
      }
    }
    const cc = new Mesh(new RingGeometry(FIELD.centerRadius - W / 2, FIELD.centerRadius + W / 2, 64), lineMat);
    cc.rotation.x = -Math.PI / 2; cc.position.y = y;
    this.group.add(cc);
    const cs = new Mesh(new RingGeometry(0, 0.18, 16), lineMat);
    cs.rotation.x = -Math.PI / 2; cs.position.y = y;
    this.group.add(cs);
  }

  private buildStands(quality: 'alta' | 'media') {
    const standMat = new MeshLambertMaterial({ color: this.theme.standColor });
    const roofMat = new MeshLambertMaterial({ color: '#d0d6de' });
    const L = FIELD.halfLength + 9, H = FIELD.halfWidth + 9;
    const rows = 12, depth = 1.2, rise = 0.75;
    const sides: { len: number; pos: (o: number) => [number, number]; ry: number }[] = [
      { len: L * 2, pos: (o) => [0, -(H + o)], ry: 0 },
      { len: L * 2, pos: (o) => [0, H + o], ry: Math.PI },
      { len: H * 2, pos: (o) => [L + o, 0], ry: -Math.PI / 2 },
      { len: H * 2, pos: (o) => [-(L + o), 0], ry: Math.PI / 2 }
    ];
    const seatsPerMeter = quality === 'alta' ? 1.1 : 0.7;
    let total = 0;
    for (const s of sides) total += Math.floor(s.len * seatsPerMeter) * rows;
    const crowdGeo = new BoxGeometry(0.45, 0.8, 0.4);
    crowdGeo.translate(0, 0.4, 0);
    const mat = new MeshLambertMaterial({ color: '#ffffff' });
    const u = this.crowdUniforms;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = u.uTime;
      sh.uniforms.uExcite = u.uExcite;
      sh.vertexShader = 'uniform float uTime; uniform float uExcite;\n' + sh.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float ph = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 2.3;
        float bob = sin(uTime * (2.0 + uExcite * 6.0) + ph) * 0.5 + 0.5;
        transformed.y += bob * (0.06 + uExcite * 0.7);`
      );
    };
    const crowd = new InstancedMesh(crowdGeo, mat, total);
    const palette = ['#e63946', '#f1faee', '#457b9d', '#1d3557', '#ffb703', '#fb8500', '#2a9d8f', '#8338ec', '#ff006e', '#3a86ff', '#ffffff', '#222222'];
    const dummy = new Object3D();
    const col = new Color();
    let idx = 0;
    for (const s of sides) {
      for (let r = 0; r < rows; r++) {
        const off = r * depth;
        const [cx, cz] = s.pos(off);
        const step = new Mesh(new BoxGeometry(s.len + r * 2.4, rise, depth), standMat);
        step.position.set(cx, r * rise + rise / 2, cz);
        step.rotation.y = s.ry;
        step.receiveShadow = false;
        this.group.add(step);
        const n = Math.floor(s.len * seatsPerMeter);
        for (let i = 0; i < n; i++) {
          if (Math.random() < 0.08) continue;
          const along = -s.len / 2 + (i + 0.5 + (Math.random() - 0.5) * 0.3) * (s.len / n);
          dummy.position.set(along, (r + 1) * rise, 0);
          dummy.position.applyAxisAngle(new Vector3(0, 1, 0), s.ry);
          dummy.position.x += cx; dummy.position.z += cz;
          dummy.rotation.set(0, s.ry, 0);
          const sc = 0.85 + Math.random() * 0.3;
          dummy.scale.set(sc, sc, sc);
          dummy.updateMatrix();
          crowd.setMatrixAt(idx, dummy.matrix);
          crowd.setColorAt(idx, col.set(palette[Math.floor(Math.random() * palette.length)]));
          idx++;
        }
      }
      // tetto
      const [rx, rz] = s.pos(rows * depth * 0.6);
      const roof = new Mesh(new BoxGeometry(s.len + 30, 0.4, rows * depth * 1.3), roofMat);
      roof.position.set(rx, rows * rise + 5, rz);
      roof.rotation.y = s.ry;
      this.group.add(roof);
    }
    crowd.count = idx;
    this.group.add(crowd);
    return mat;
  }

  private buildFloodlights() {
    const L = FIELD.halfLength + 38, H = FIELD.halfWidth + 36;
    const glow = canvasTex(64, 64, (c) => {
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,250,220,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    });
    const smat = new SpriteMaterial({ map: glow, blending: AdditiveBlending, depthWrite: false, fog: false });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const pole = new Mesh(new CylinderGeometry(0.6, 0.9, 46, 8), new MeshLambertMaterial({ color: '#8a8f99' }));
      pole.position.set(sx * L, 23, sz * H);
      this.group.add(pole);
      const head = new Mesh(new BoxGeometry(6, 3, 0.6), new MeshBasicMaterial({ color: '#fffbe6' }));
      head.position.set(sx * L, 47, sz * H);
      head.lookAt(0, 0, 0);
      this.group.add(head);
      const sp = new Sprite(smat);
      sp.scale.set(34, 34, 1);
      sp.position.copy(head.position);
      this.group.add(sp);
    }
  }

  private buildSnow() {
    const n = 1500;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set([(Math.random() - 0.5) * 120, Math.random() * 40, (Math.random() - 0.5) * 90], i * 3);
    const g = new BufferGeometry(); g.setAttribute('position', new BufferAttribute(pos, 3));
    this.snow = new Points(g, new PointsMaterial({ color: '#ffffff', size: 0.25, transparent: true, opacity: 0.85 }));
    this.group.add(this.snow);
  }

  /** Fuochi d'artificio / coriandoli per i gol */
  fireworksAt(center: Vector3, colors = ['#ffd700', '#ff3b3b', '#3bc8ff', '#7dff3b']) {
    const n = 260;
    const pos = new Float32Array(n * 3), cols = new Float32Array(n * 3), vel = new Float32Array(n * 3);
    const c = new Color();
    for (let i = 0; i < n; i++) {
      pos.set([center.x, center.y, center.z], i * 3);
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), sp = 6 + Math.random() * 8;
      vel.set([Math.sin(ph) * Math.cos(th) * sp, Math.abs(Math.cos(ph)) * sp + 3, Math.sin(ph) * Math.sin(th) * sp], i * 3);
      c.set(colors[i % colors.length]);
      cols.set([c.r, c.g, c.b], i * 3);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('color', new BufferAttribute(cols, 3));
    const pts = new Points(g, new PointsMaterial({ size: 0.35, vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false }));
    this.group.add(pts);
    this.fireworks.push({ pts, vel, t: 0 });
  }

  setExcitement(v: number) { this.crowdUniforms.uExcite.value = v; if (this.crowd) this.crowd.uniforms.uExcite.value = v; }

  update(dt: number, time: number) {
    this.crowdUniforms.uTime.value = time;
    this.crowd.uniforms.uTime.value = time;
    this.flags.update(time);
    this.led.update(time);
    this.goal.update(dt);
    if (this.snow) {
      const a = this.snow.geometry.attributes.position as BufferAttribute;
      const arr = a.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] -= dt * 1.5;
        arr[i] += Math.sin(time + i) * dt * 0.3;
        if (arr[i + 1] < 0) arr[i + 1] = 40;
      }
      a.needsUpdate = true;
    }
    for (const f of this.fireworks) {
      f.t += dt;
      const a = f.pts.geometry.attributes.position as BufferAttribute;
      const arr = a.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        f.vel[i + 1] -= 6 * dt;
        f.vel[i] *= 0.99; f.vel[i + 2] *= 0.99;
        arr[i] += f.vel[i] * dt; arr[i + 1] += f.vel[i + 1] * dt; arr[i + 2] += f.vel[i + 2] * dt;
      }
      a.needsUpdate = true;
      (f.pts.material as PointsMaterial).opacity = Math.max(0, 1 - f.t / 2.5);
    }
    this.fireworks = this.fireworks.filter((f) => {
      if (f.t > 2.5) { this.group.remove(f.pts); f.pts.geometry.dispose(); return false; }
      return true;
    });
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o: any) => {
      o.geometry?.dispose?.();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m: any) => { m.map?.dispose?.(); m.dispose?.(); });
    });
  }
}
