// Costruzione dello stadio 3D: campo, erba, porte con reti animate, spalti, pubblico, bandiere, luci, tabellone.
import * as THREE from '../vendor/three.module.min.js';

export const FIELD = { HL: 34, HW: 21, GOAL_W: 3.3, GOAL_H: 2.35, GOAL_D: 1.8, BOX_D: 12, BOX_W: 11, PEN: 9 };

const SKY = {
  day:    { top: '#3f8cff', bottom: '#cfe9ff', sun: 1.25, hemi: 0.95, fog: '#cfe4ff', ground: '#4c8b3a', light: '#fff6e0' },
  sunset: { top: '#4a3aa8', bottom: '#ffb56b', sun: 1.0,  hemi: 0.8,  fog: '#f2b48a', ground: '#4c7a33', light: '#ffd0a0' },
  night:  { top: '#05081c', bottom: '#1d2a5a', sun: 1.1,  hemi: 0.75, fog: '#1b2550', ground: '#3d7a35', light: '#e8f0ff' },
  cloudy: { top: '#8aa7c9', bottom: '#e3edf5', sun: 0.95, hemi: 1.05, fog: '#dfe8ef', ground: '#4f8a3d', light: '#ffffff' }
};

export class World {
  constructor(renderer, opts) {
    this.renderer = renderer;
    this.opts = opts; // { stadium, quality, homeColors:[c1,c2], awayColors:[c1,c2], homeShort, awayShort }
    this.scene = new THREE.Scene();
    this.time = 0;
    this.excite = 0;      // eccitazione del pubblico (0..1)
    this.uniforms = { uTime: { value: 0 }, uExcite: { value: 0 } };
    this.nets = [];
    this.disposables = [];
    this.q = opts.quality === 'alta' ? 2 : opts.quality === 'media' ? 1 : 0;
    const sky = SKY[opts.stadium.time] || SKY.day;
    this.sky = sky;
    this.build();
  }

  build() {
    const { scene } = this;
    const sky = this.sky;
    scene.fog = new THREE.Fog(sky.fog, 90, 220);
    // cielo a gradiente
    const skyGeo = new THREE.SphereGeometry(300, 24, 12);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(sky.top) }, bottom: { value: new THREE.Color(sky.bottom) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y*1.6+0.1,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, h),1.0); }'
    });
    scene.add(new THREE.Mesh(skyGeo, skyMat));
    if (this.opts.stadium.time === 'night') this.addStars();

    // luci
    const hemi = new THREE.HemisphereLight(0xffffff, sky.ground, sky.hemi);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(sky.light, sky.sun);
    sun.position.set(-30, 60, 40);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(30, 30, -40);
    scene.add(fill);
    this.sun = sun;

    this.buildPitch();
    this.buildGoals();
    this.buildStands();
    this.buildBoards();
    this.buildFlags();
    this.buildLightsTowers();
    this.buildScoreboard();
  }

  addStars() {
    const n = 400, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = 0.25 + Math.random() * 1.2;
      pos[i * 3] = Math.cos(a) * Math.cos(e) * 280; pos[i * 3 + 1] = Math.sin(e) * 280; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 280;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false })));
  }

  buildPitch() {
    const { HL, HW } = FIELD;
    // texture a strisce con linee del campo
    const W = 1024, H = 640;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const ext = 6; // margine attorno al campo
    const sx = W / (2 * (HL + ext)), sz = H / (2 * (HW + ext));
    const X = x => (x + HL + ext) * sx, Z = z => (z + HW + ext) * sz;
    g.fillStyle = '#3d8f35'; g.fillRect(0, 0, W, H);
    const nStripes = 14;
    for (let i = 0; i < nStripes; i++) {
      g.fillStyle = i % 2 ? '#47a03c' : '#3c9134';
      g.fillRect(X(-HL + (i * 2 * HL) / nStripes), Z(-HW), (2 * HL / nStripes) * sx + 1, 2 * HW * sz);
    }
    // variazioni
    for (let i = 0; i < 2500; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '20,60,20' : '120,190,90'},0.05)`;
      g.fillRect(Math.random() * W, Math.random() * H, 3, 3);
    }
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 3.2;
    g.strokeRect(X(-HL), Z(-HW), 2 * HL * sx, 2 * HW * sz);
    g.beginPath(); g.moveTo(X(0), Z(-HW)); g.lineTo(X(0), Z(HW)); g.stroke();
    g.beginPath(); g.ellipse(X(0), Z(0), 6 * sx, 6 * sz, 0, 0, Math.PI * 2); g.stroke();
    for (const s of [-1, 1]) {
      const gx = s * HL;
      g.strokeRect(Math.min(X(gx), X(gx - s * FIELD.BOX_D)), Z(-FIELD.BOX_W), FIELD.BOX_D * sx, 2 * FIELD.BOX_W * sz);
      g.strokeRect(Math.min(X(gx), X(gx - s * 4.5)), Z(-6), 4.5 * sx, 12 * sz);
      g.fillStyle = '#fff';
      g.beginPath(); g.ellipse(X(gx - s * FIELD.PEN), Z(0), 3, 3, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(X(gx - s * FIELD.PEN), Z(0), 6 * sx, 6 * sz, 0, s > 0 ? Math.PI * 0.62 : -Math.PI * 0.38, s > 0 ? Math.PI * 1.38 : Math.PI * 0.38); g.stroke();
    }
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(X(0), Z(0), 3, 3, 0, 0, Math.PI * 2); g.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2 * (HL + ext), 2 * (HW + ext)), new THREE.MeshLambertMaterial({ map: tex }));
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);
    // terreno esterno
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshLambertMaterial({ color: 0x2f6e2a }));
    outer.rotation.x = -Math.PI / 2; outer.position.y = -0.02;
    this.scene.add(outer);

    // erba tridimensionale: fili d'erba istanziati che ondeggiano col vento
    const blades = [0, 9000, 22000][this.q];
    if (blades) {
      const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.03, 0, 0, 0.03, 0, 0, 0, 0.11, 0.01]), 3));
      bg.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
      const bm = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
      bm.onBeforeCompile = sh => {
        sh.uniforms.uTime = this.uniforms.uTime;
        sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>',
          `#include <begin_vertex>
           float ph = instanceMatrix[3].x*0.35 + instanceMatrix[3].z*0.2;
           transformed.x += position.y * sin(uTime*2.0 + ph) * 0.35;`);
      };
      const im = new THREE.InstancedMesh(bg, bm, blades);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
      const col = new THREE.Color();
      for (let i = 0; i < blades; i++) {
        p.set((Math.random() * 2 - 1) * (HL + 1), 0, (Math.random() * 2 - 1) * (HW + 1));
        e.set(0, Math.random() * Math.PI, 0); q.setFromEuler(e);
        const k = 0.7 + Math.random() * 0.8; s.set(k, k, k);
        m.compose(p, q, s); im.setMatrixAt(i, m);
        col.setHSL(0.29 + Math.random() * 0.04, 0.5, 0.3 + Math.random() * 0.1);
        im.setColorAt(i, col);
      }
      im.frustumCulled = false;
      this.scene.add(im);
    }
  }

  buildGoals() {
    const { HL, GOAL_W, GOAL_H, GOAL_D } = FIELD;
    const postMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x333333 });
    const postGeo = new THREE.CylinderGeometry(0.08, 0.08, GOAL_H, 10);
    const barGeo = new THREE.CylinderGeometry(0.08, 0.08, GOAL_W * 2 + 0.16, 10);
    // texture della rete
    const nc = document.createElement('canvas'); nc.width = nc.height = 64;
    const ng = nc.getContext('2d');
    ng.strokeStyle = 'rgba(255,255,255,0.9)'; ng.lineWidth = 3;
    ng.strokeRect(0, 0, 64, 64);
    const netTex = new THREE.CanvasTexture(nc);
    netTex.wrapS = netTex.wrapT = THREE.RepeatWrapping;
    for (const s of [-1, 1]) {
      const grp = new THREE.Group();
      const gx = s * HL;
      for (const z of [-GOAL_W, GOAL_W]) {
        const p = new THREE.Mesh(postGeo, postMat); p.position.set(gx, GOAL_H / 2, z); grp.add(p);
        const bp = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, GOAL_H, 6), postMat);
        bp.position.set(gx + s * GOAL_D, GOAL_H / 2, z); grp.add(bp);
      }
      const bar = new THREE.Mesh(barGeo, postMat); bar.rotation.x = Math.PI / 2; bar.position.set(gx, GOAL_H, 0); grp.add(bar);
      const mk = (w, h, rep) => {
        const t = netTex.clone(); t.needsUpdate = true; t.repeat.set(rep[0], rep[1]);
        return new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.85 });
      };
      // rete posteriore (animata)
      const backGeo = new THREE.PlaneGeometry(GOAL_W * 2, GOAL_H, 16, 8);
      const back = new THREE.Mesh(backGeo, mk(GOAL_W * 2, GOAL_H, [GOAL_W * 2 / 0.25, GOAL_H / 0.25]));
      back.rotation.y = Math.PI / 2; back.position.set(gx + s * GOAL_D, GOAL_H / 2, 0);
      grp.add(back);
      const top = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_D, GOAL_W * 2), mk(0, 0, [GOAL_D / 0.25, GOAL_W * 2 / 0.25]));
      top.rotation.x = -Math.PI / 2; top.position.set(gx + s * GOAL_D / 2, GOAL_H, 0); grp.add(top);
      for (const z of [-GOAL_W, GOAL_W]) {
        const side = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_D, GOAL_H), mk(0, 0, [GOAL_D / 0.25, GOAL_H / 0.25]));
        side.position.set(gx + s * GOAL_D / 2, GOAL_H / 2, z); grp.add(side);
      }
      this.scene.add(grp);
      this.nets.push({ side: s, geo: backGeo, base: backGeo.attributes.position.array.slice(), hit: null });
    }
    // bandierine del calcio d'angolo
    const flagMat = new THREE.MeshLambertMaterial({ color: 0xffd23f, side: THREE.DoubleSide });
    for (const x of [-HL, HL]) for (const z of [-FIELD.HW, FIELD.HW]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6), postMat); pole.position.set(x, 0.75, z);
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), flagMat); f.position.set(x + 0.2 * Math.sign(-x), 1.35, z);
      this.scene.add(pole, f);
    }
  }

  // rete che si gonfia quando entra la palla
  netHit(side, z, y, power) {
    const n = this.nets.find(n => n.side === side);
    if (n) n.hit = { z, y, t: 0, p: Math.min(1.2, power) };
  }

  buildStands() {
    const { HL, HW } = FIELD;
    const st = this.opts.stadium;
    const standMat = new THREE.MeshLambertMaterial({ color: st.stand });
    const seatMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(st.stand).multiplyScalar(0.8) });
    const roofMat = new THREE.MeshLambertMaterial({ color: st.roof });
    const rows = 9, step = 1.1, rise = 0.75;
    const sides = [
      { len: 2 * HL + 16, pos: (r) => [0, 0, -(HW + 7 + r * step)], rotY: 0 },
      { len: 2 * HL + 16, pos: (r) => [0, 0, (HW + 7 + r * step)], rotY: Math.PI },
      { len: 2 * HW + 10, pos: (r) => [-(HL + 8 + r * step), 0, 0], rotY: Math.PI / 2 },
      { len: 2 * HW + 10, pos: (r) => [(HL + 8 + r * step), 0, 0], rotY: -Math.PI / 2 }
    ];
    const seats = [];
    for (const sd of sides) {
      for (let r = 0; r < rows; r++) {
        const [x, , z] = sd.pos(r);
        const b = new THREE.Mesh(new THREE.BoxGeometry(sd.len + r * 2.2, rise * (r + 1), step), r % 2 ? standMat : seatMat);
        b.position.set(x, rise * (r + 1) / 2, z); b.rotation.y = sd.rotY;
        this.scene.add(b);
        seats.push({ sd, r, x, z });
      }
      // tetto
      const [x, , z] = sd.pos(rows + 1);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(sd.len + rows * 2.2 + 4, 0.5, 7), roofMat);
      const dir = new THREE.Vector3(x, 0, z).normalize();
      roof.position.set(x - dir.x * 2.5, rise * rows + 5, z - dir.z * 2.5); roof.rotation.y = sd.rotY;
      roof.rotation.x = 0; this.scene.add(roof);
      const back = new THREE.Mesh(new THREE.BoxGeometry(sd.len + rows * 2.2 + 4, rise * rows + 5, 0.6), roofMat);
      back.position.set(x + dir.x * 0.5, (rise * rows + 5) / 2, z + dir.z * 0.5); back.rotation.y = sd.rotY;
      this.scene.add(back);
    }
    // pubblico animato (istanze, animazione nella GPU per risparmiare batteria)
    const count = [900, 2200, 4200][this.q];
    const bodyGeo = new THREE.BoxGeometry(0.5, 0.7, 0.35); bodyGeo.translate(0, 0.35, 0);
    const headGeo = new THREE.SphereGeometry(0.2, 8, 6); headGeo.translate(0, 0.9, 0);
    const crowdMat = new THREE.MeshLambertMaterial();
    crowdMat.onBeforeCompile = sh => {
      sh.uniforms.uTime = this.uniforms.uTime; sh.uniforms.uExcite = this.uniforms.uExcite;
      sh.vertexShader = 'uniform float uTime; uniform float uExcite;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        `#include <begin_vertex>
         float id = float(gl_InstanceID);
         float ph = fract(sin(id*12.9898)*43758.5453)*6.2831;
         float sp = 3.0 + uExcite*6.0;
         float jump = max(0.0, sin(uTime*sp + ph)) * (0.05 + uExcite*0.55);
         transformed.y += jump;`);
    };
    const bodies = new THREE.InstancedMesh(bodyGeo, crowdMat, count);
    const heads = new THREE.InstancedMesh(headGeo, crowdMat, count);
    const hc = this.opts.homeColors, ac = this.opts.awayColors;
    const skins = ['#f1c7a5', '#e0ac84', '#c68a62', '#8d5a3b', '#f6d5bd'];
    const m = new THREE.Matrix4(), col = new THREE.Color(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < count; i++) {
      const seat = seats[Math.floor(Math.random() * seats.length)];
      const along = (Math.random() - 0.5) * (seat.sd.len + seat.r * 2.2 - 1);
      const lx = Math.cos(seat.sd.rotY) * along, lz = -Math.sin(seat.sd.rotY) * along;
      p.set(seat.x + lx, rise * (seat.r + 1), seat.z + lz);
      e.set(0, seat.sd.rotY, 0); q.setFromEuler(e);
      m.compose(p, q, s);
      bodies.setMatrixAt(i, m); heads.setMatrixAt(i, m);
      const rr = Math.random();
      col.set(rr < 0.55 ? (Math.random() < 0.6 ? hc[0] : hc[1]) : rr < 0.8 ? (Math.random() < 0.6 ? ac[0] : ac[1]) : `hsl(${Math.random() * 360},70%,55%)`);
      bodies.setColorAt(i, col);
      heads.setColorAt(i, col.set(skins[i % skins.length]));
    }
    bodies.frustumCulled = heads.frustumCulled = false;
    this.scene.add(bodies, heads);
  }

  buildBoards() {
    // cartelloni a bordo campo (nessuna pubblicità: messaggi per Andrea)
    const { HL, HW } = FIELD;
    const msgs = ['FORZA ANDREA!', 'ANDREA FOOTBALL CHAMPIONS', 'SEI UN CAMPIONE!', 'GOOOL!', 'DAI ANDREA!'];
    const colors = ['#ff4f6d', '#2f7bff', '#ffb000', '#18b26b', '#9b5cff'];
    const mats = msgs.map((t, i) => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 64;
      const g = c.getContext('2d');
      g.fillStyle = colors[i]; g.fillRect(0, 0, 512, 64);
      g.fillStyle = '#fff'; g.font = 'bold 40px Fredoka, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(t, 256, 34);
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshBasicMaterial({ map: tx });
    });
    const geo = new THREE.PlaneGeometry(10, 1.1);
    let k = 0;
    for (let x = -HL + 2; x < HL; x += 10.2) {
      for (const z of [-HW - 3, HW + 3]) {
        const b = new THREE.Mesh(geo, mats[k++ % mats.length]);
        b.position.set(x + 5, 0.55, z); if (z > 0) b.rotation.y = Math.PI;
        this.scene.add(b);
      }
    }
    for (let z = -HW + 2; z < HW - 4; z += 10.2) {
      for (const x of [-HL - 4, HL + 4]) {
        if (Math.abs(z + 5) < 6) continue;
        const b = new THREE.Mesh(geo, mats[k++ % mats.length]);
        b.position.set(x, 0.55, z + 5); b.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
        this.scene.add(b);
      }
    }
  }

  buildFlags() {
    const { HL, HW } = FIELD;
    const hc = this.opts.homeColors, ac = this.opts.awayColors;
    const geo = new THREE.PlaneGeometry(2.4, 1.5, 10, 4);
    geo.translate(1.2, 0, 0);
    const mk = (a, b) => {
      const c = document.createElement('canvas'); c.width = 64; c.height = 32;
      const g = c.getContext('2d'); g.fillStyle = a; g.fillRect(0, 0, 64, 32); g.fillStyle = b; g.fillRect(0, 11, 64, 10);
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.MeshLambertMaterial({ map: tx, side: THREE.DoubleSide });
      m.onBeforeCompile = sh => {
        sh.uniforms.uTime = this.uniforms.uTime; sh.uniforms.uExcite = this.uniforms.uExcite;
        sh.vertexShader = 'uniform float uTime; uniform float uExcite;\n' + sh.vertexShader.replace('#include <begin_vertex>',
          `#include <begin_vertex>
           transformed.z += sin(position.x*2.5 - uTime*(5.0+uExcite*6.0) + modelMatrix[3].x) * 0.18 * position.x;
           transformed.y += sin(position.x*1.7 - uTime*4.0) * 0.06 * position.x;`);
      };
      return m;
    };
    const mats = [mk(hc[0], hc[1]), mk(ac[0], ac[1]), mk('#2e9e4f', '#ffffff')];
    const poleMat = new THREE.MeshLambertMaterial({ color: 0xdddddd });
    let i = 0;
    for (let x = -HL; x <= HL; x += 8.5) {
      for (const z of [-(HW + 18.5), HW + 18.5]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4, 6), poleMat);
        pole.position.set(x, 9.5, z);
        const f = new THREE.Mesh(geo, mats[i++ % 3]); f.position.set(x, 10.8, z);
        this.scene.add(pole, f);
      }
    }
  }

  buildLightsTowers() {
    const { HL, HW } = FIELD;
    const night = this.opts.stadium.time === 'night' || this.opts.stadium.time === 'sunset';
    const towerMat = new THREE.MeshLambertMaterial({ color: 0x8a8f9a });
    const lampMat = new THREE.MeshBasicMaterial({ color: night ? 0xffffff : 0xe8eef7 });
    const glowTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,250,220,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
    })();
    for (const x of [-HL - 12, HL + 12]) for (const z of [-HW - 16, HW + 16]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 26, 8), towerMat); t.position.set(x, 13, z);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 0.5), lampMat); panel.position.set(x, 27, z);
      panel.lookAt(0, 0, 0);
      this.scene.add(t, panel);
      if (night) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
        sp.scale.set(14, 14, 1); sp.position.set(x * 0.98, 27, z * 0.98); this.scene.add(sp);
      }
    }
    if (night) {
      // luce dei riflettori sul campo
      const l1 = new THREE.DirectionalLight(0xffffff, 0.5); l1.position.set(40, 40, -30); this.scene.add(l1);
    }
  }

  buildScoreboard() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 160;
    this.sbCanvas = c;
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
    this.sbTex = tx;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(16, 5), new THREE.MeshBasicMaterial({ map: tx, fog: false }));
    screen.position.set(0, 16.5, -(FIELD.HW + 20));
    const frame = new THREE.Mesh(new THREE.BoxGeometry(17, 6, 0.6), new THREE.MeshLambertMaterial({ color: 0x222633 }));
    frame.position.set(0, 16.5, -(FIELD.HW + 20.4));
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.8, 14, 0.8), new THREE.MeshLambertMaterial({ color: 0x555b66 }));
    leg.position.set(0, 7, -(FIELD.HW + 20.6));
    this.scene.add(frame, screen, leg);
    this.updateScoreboard(0, 0, "0'", '');
  }
  updateScoreboard(h, a, clock, msg) {
    const g = this.sbCanvas.getContext('2d');
    g.fillStyle = '#0b0f1e'; g.fillRect(0, 0, 512, 160);
    g.fillStyle = '#ffd23f'; g.font = 'bold 30px Fredoka, Arial, sans-serif'; g.textAlign = 'center';
    g.fillText(msg || 'ANDREA FOOTBALL CHAMPIONS', 256, 36);
    g.fillStyle = '#fff'; g.font = 'bold 64px Fredoka, Arial, sans-serif';
    g.fillText(`${this.opts.homeShort}  ${h} - ${a}  ${this.opts.awayShort}`, 256, 108);
    g.fillStyle = '#7fe0ff'; g.font = 'bold 28px Fredoka, Arial, sans-serif';
    g.fillText(clock, 256, 146);
    this.sbTex.needsUpdate = true;
  }

  update(dt) {
    this.time += dt;
    this.uniforms.uTime.value = this.time;
    this.excite = Math.max(0, this.excite - dt * 0.12);
    this.uniforms.uExcite.value = this.excite;
    // animazione rete
    for (const n of this.nets) {
      if (!n.hit) continue;
      n.hit.t += dt;
      const pos = n.geo.attributes.position.array;
      const { t, p } = n.hit;
      const amp = p * 0.9 * Math.exp(-t * 2.5) * Math.cos(t * 9);
      for (let i = 0; i < pos.length; i += 3) {
        const lx = n.base[i], ly = n.base[i + 1];
        // il piano è ruotato: x locale -> -z mondo
        const dz = (-lx) - n.hit.z, dy = (ly + FIELD.GOAL_H / 2) - n.hit.y;
        const f = Math.exp(-(dz * dz + dy * dy) * 0.6);
        pos[i + 2] = n.base[i + 2] + amp * f * (n.side > 0 ? -1 : 1) * -1;
      }
      n.geo.attributes.position.needsUpdate = true;
      if (t > 2) { n.hit = null; pos.set(n.base); n.geo.attributes.position.needsUpdate = true; }
    }
  }

  dispose() {
    this.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
      }
    });
  }
}
