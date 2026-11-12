import {
  BoxGeometry, BufferAttribute, CanvasTexture, Color, DoubleSide, Group, InstancedBufferAttribute, InstancedMesh, Mesh,
  MeshBasicMaterial, MeshLambertMaterial, MeshStandardMaterial, Object3D, PlaneGeometry, RepeatWrapping, SRGBColorSpace, Texture, Vector3
} from 'three';
import { FIELD } from '../physics/constants';
import type { StadiumTheme } from './themes';

const canvas = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c: HTMLCanvasElement, srgb = true) => { const t = new CanvasTexture(c); if (srgb) t.colorSpace = SRGBColorSpace; return t; };

/** Rumore "value noise" deterministico per texture procedurali */
function noise2(seed: number) {
  const perm = new Uint8Array(512);
  let s = seed;
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const g = (x: number, y: number) => perm[(perm[x & 255] + y) & 511] / 255;
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = g(xi, yi), b = g(xi + 1, yi), c = g(xi, yi + 1), d = g(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

// ------------------------------------------------------------------ PRATO
/** Prato realistico: fili d'erba, variazioni di colore, strisce di taglio e normal map */
export function buildGrass(theme: StadiumTheme): Mesh {
  const N = 512;
  const c = canvas(N, N), ctx = c.getContext('2d')!;
  const base = new Color(theme.grassB);
  ctx.fillStyle = theme.grassB;
  ctx.fillRect(0, 0, N, N);
  const n = noise2(7);
  const img = ctx.getImageData(0, 0, N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const v = n(x / 40, y / 40) * 0.5 + n(x / 9, y / 9) * 0.3 + Math.random() * 0.2;
    const k = 0.78 + v * 0.4;
    const i = (y * N + x) * 4;
    img.data[i] = Math.min(255, base.r * 255 * k * 0.95);
    img.data[i + 1] = Math.min(255, base.g * 255 * k);
    img.data[i + 2] = Math.min(255, base.b * 255 * k * 0.9);
  }
  ctx.putImageData(img, 0, 0);
  // fili d'erba
  for (let i = 0; i < 26000; i++) {
    const x = Math.random() * N, y = Math.random() * N, l = 2 + Math.random() * 4;
    const light = Math.random() < 0.5;
    ctx.strokeStyle = light ? `rgba(200,255,150,${0.06 + Math.random() * 0.1})` : `rgba(0,40,0,${0.08 + Math.random() * 0.12})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (Math.random() - 0.5) * 2, y - l); ctx.stroke();
  }
  const map = tex(c);
  map.wrapS = map.wrapT = RepeatWrapping;
  map.repeat.set(26, 18);
  map.anisotropy = 8;
  // normal map dalla stessa texture
  const nc = canvas(256, 256), nctx = nc.getContext('2d')!;
  const nimg = nctx.createImageData(256, 256);
  const h = (x: number, y: number) => n(x / 6, y / 6) + Math.random() * 0.25;
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const dx = h(x + 1, y) - h(x - 1, y), dy = h(x, y + 1) - h(x, y - 1);
    const i = (y * 256 + x) * 4;
    nimg.data[i] = 128 + dx * 90; nimg.data[i + 1] = 128 + dy * 90; nimg.data[i + 2] = 255; nimg.data[i + 3] = 255;
  }
  nctx.putImageData(nimg, 0, 0);
  const nmap = tex(nc, false);
  nmap.wrapS = nmap.wrapT = RepeatWrapping;
  nmap.repeat.set(60, 40);
  const mat = new MeshStandardMaterial({ map, normalMap: nmap, roughness: 0.92, metalness: 0, envMapIntensity: 0.4 });
  const stripeA = new Color(theme.grassA), stripeB = new Color(theme.grassB);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uStripe = { value: 5.25 };
    sh.uniforms.uA = { value: stripeA };
    sh.uniforms.uB = { value: stripeB };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos; uniform float uStripe; uniform vec3 uA; uniform vec3 uB;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float band = step(0.5, fract(vWPos.x / (uStripe * 2.0)));
        float cross = step(0.5, fract(vWPos.z / (uStripe * 2.6)));
        float shade = mix(0.84, 1.08, band) * mix(0.97, 1.03, cross);
        // variazione a larga scala (zone più chiare/scure come un prato vero)
        float big = sin(vWPos.x * 0.07) * sin(vWPos.z * 0.09) * 0.05;
        diffuseColor.rgb *= shade + big;`);
  };
  const m = new Mesh(new PlaneGeometry(FIELD.halfLength * 2 + 16, FIELD.halfWidth * 2 + 14), mat);
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}

// ------------------------------------------------------------------ PUBBLICO
const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#d1a17a', '#5c3a21'];
const HAIR = ['#1b1209', '#3b2412', '#7a4a1e', '#c9a050', '#0d0d0d', '#8a8a8a', '#5b3015'];

/** Atlante di tifosi disegnati (originali): 16 tifosi × 2 pose (seduto / esultanza) */
function crowdAtlas(shirtColors: string[]): Texture {
  const CW = 64, CH = 128, COLS = 16;
  const c = canvas(CW * COLS, CH * 2), ctx = c.getContext('2d')!;
  for (let pose = 0; pose < 2; pose++) for (let i = 0; i < COLS; i++) {
    const ox = i * CW, oy = pose * CH;
    const skin = SKIN[(i * 3) % SKIN.length], hair = HAIR[(i * 5) % HAIR.length];
    const shirt = shirtColors[i % shirtColors.length];
    const cx = ox + CW / 2;
    const up = pose === 1;
    // braccia
    ctx.strokeStyle = shirt; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath();
    if (up) { ctx.moveTo(cx - 13, oy + 64); ctx.lineTo(cx - 22, oy + 30); ctx.moveTo(cx + 13, oy + 64); ctx.lineTo(cx + 22, oy + 30); }
    else { ctx.moveTo(cx - 14, oy + 66); ctx.lineTo(cx - 17, oy + 98); ctx.moveTo(cx + 14, oy + 66); ctx.lineTo(cx + 17, oy + 98); }
    ctx.stroke();
    ctx.fillStyle = skin;
    if (up) { ctx.beginPath(); ctx.arc(cx - 23, oy + 26, 5, 0, 7); ctx.arc(cx + 23, oy + 26, 5, 0, 7); ctx.fill(); }
    // busto
    ctx.fillStyle = shirt;
    ctx.beginPath(); ctx.moveTo(cx - 17, oy + 128); ctx.lineTo(cx - 17, oy + 70); ctx.quadraticCurveTo(cx - 16, oy + 60, cx, oy + 59); ctx.quadraticCurveTo(cx + 16, oy + 60, cx + 17, oy + 70); ctx.lineTo(cx + 17, oy + 128); ctx.fill();
    // ombreggiatura
    const g = ctx.createLinearGradient(cx - 17, 0, cx + 17, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.25)'); g.addColorStop(0.5, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = g; ctx.fillRect(cx - 17, oy + 60, 34, 68);
    if (i % 4 === 1) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(cx - 17, oy + 80, 34, 6); } // sciarpa
    // collo e testa
    ctx.fillStyle = skin;
    ctx.fillRect(cx - 4, oy + 50, 8, 10);
    ctx.beginPath(); ctx.ellipse(cx, oy + 42, 10, 12, 0, 0, 7); ctx.fill();
    ctx.fillStyle = hair;
    ctx.beginPath(); ctx.ellipse(cx, oy + 36, 10.5, 7, 0, Math.PI, 0); ctx.fill();
    if (i % 5 === 2) { ctx.fillStyle = shirt; ctx.fillRect(cx - 11, oy + 30, 22, 6); } // cappellino
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(cx - 5, oy + 41, 3, 2); ctx.fillRect(cx + 2, oy + 41, 3, 2);
  }
  const t = tex(c);
  t.anisotropy = 4;
  return t;
}

export interface CrowdHandle { uniforms: { uTime: { value: number }; uExcite: { value: number } } }

/** Stadio a due anelli (tribune a gradoni, tetto, sedili) pieno di tifosi animati */
export function buildBowl(group: Group, theme: StadiumTheme, quality: 'alta' | 'media', homeColors: string[]): CrowdHandle {
  const uniforms = { uTime: { value: 0 }, uExcite: { value: 0 } };
  const concrete = new MeshStandardMaterial({ color: theme.standColor, roughness: 0.9 });
  const seatCols = ['#1d4ed8', '#1e3a8a'];
  const seatMat = new MeshLambertMaterial({ color: seatCols[0] });
  const roofMat = new MeshStandardMaterial({ color: '#3a4250', roughness: 0.7, metalness: 0.3 });
  const L = FIELD.halfLength + 8, H = FIELD.halfWidth + 7;
  const tiers = [
    { start: 0, rows: 14, rise: 0.42, depth: 0.82, y0: 1.0 },
    { start: 14 * 0.82 + 3.5, rows: 13, rise: 0.55, depth: 0.85, y0: 14 * 0.42 + 4.2 }
  ];
  const sides = [
    { len: L * 2 + 20, pos: (o: number): [number, number] => [0, -(H + o)], ry: 0 },
    { len: L * 2 + 20, pos: (o: number): [number, number] => [0, H + o], ry: Math.PI },
    { len: H * 2 + 20, pos: (o: number): [number, number] => [L + o, 0], ry: -Math.PI / 2 },
    { len: H * 2 + 20, pos: (o: number): [number, number] => [-(L + o), 0], ry: Math.PI / 2 }
  ];
  const spacing = quality === 'alta' ? 0.62 : 0.85;
  let total = 0;
  for (const s of sides) for (const t of tiers) total += Math.ceil(s.len / spacing) * t.rows;
  const plane = new PlaneGeometry(0.62, 1.24);
  plane.translate(0, 0.62, 0);
  const atlas = crowdAtlas(homeColors.concat(['#ffffff', '#1d1d1d', '#e63946', '#2a9d8f', '#f4a261', '#3a86ff', '#ffd23f', '#8338ec', '#ff006e', '#06d6a0']));
  const mat = new MeshLambertMaterial({ map: atlas, transparent: false, alphaTest: 0.5, side: DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime;
    sh.uniforms.uExcite = uniforms.uExcite;
    sh.vertexShader = 'attribute float aFan; attribute float aPhase;\nuniform float uTime; uniform float uExcite;\n' + sh.vertexShader
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        float cheer = step(0.5, uExcite) * step(0.25, fract(aPhase * 7.13)) + step(0.93, fract(aPhase * 3.7 + floor(uTime * 0.25) * 0.37));
        cheer = min(cheer, 1.0);
        vMapUv = vec2((uv.x + aFan) / 16.0, (uv.y * 0.5) + (1.0 - cheer) * 0.5);`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float speed = 2.0 + uExcite * 7.0;
        transformed.y += (sin(uTime * speed + aPhase * 6.28) * 0.5 + 0.5) * (0.03 + uExcite * 0.45);`);
  };
  const crowd = new InstancedMesh(plane, mat, total);
  const aFan = new Float32Array(total), aPhase = new Float32Array(total);
  const dummy = new Object3D();
  const seatGeo = new BoxGeometry(0.5, 0.35, 0.4);
  let seatTotal = 0;
  for (const s of sides) for (const t of tiers) seatTotal += Math.ceil(s.len / spacing) * t.rows;
  const seats = new InstancedMesh(seatGeo, seatMat, seatTotal);
  let idx = 0, sidx = 0;
  const up = new Vector3(0, 1, 0);
  const sc = new Color();
  for (const s of sides) {
    for (const t of tiers) {
      // gradoni come un unico blocco inclinato a scalini
      for (let r = 0; r < t.rows; r++) {
        const off = t.start + r * t.depth;
        const [cx, cz] = s.pos(off);
        const step = new Mesh(new BoxGeometry(s.len + off * 2, t.rise, t.depth), concrete);
        step.position.set(cx, t.y0 + r * t.rise - t.rise / 2, cz);
        step.rotation.y = s.ry;
        group.add(step);
        const n = Math.ceil(s.len / spacing);
        for (let i = 0; i < n; i++) {
          const along = -s.len / 2 + (i + 0.5) * spacing;
          dummy.position.set(along + (Math.random() - 0.5) * 0.08, t.y0 + r * t.rise, 0.05);
          dummy.position.applyAxisAngle(up, s.ry);
          dummy.position.x += cx; dummy.position.z += cz;
          dummy.rotation.set(0, s.ry, 0);
          dummy.scale.setScalar(0.92 + Math.random() * 0.16);
          dummy.updateMatrix();
          seats.setMatrixAt(sidx, dummy.matrix);
          seats.setColorAt(sidx, sc.set(seatCols[(r + (i % 7 === 0 ? 1 : 0)) % 2]));
          sidx++;
          if (Math.random() < 0.06) continue; // qualche posto vuoto
          crowd.setMatrixAt(idx, dummy.matrix);
          aFan[idx] = Math.floor(Math.random() * 16);
          aPhase[idx] = Math.random();
          idx++;
        }
      }
      // parapetto con fascia colorata
      const [px, pz] = s.pos(t.start - 0.3);
      const wall = new Mesh(new BoxGeometry(s.len + t.start * 2, 1.0, 0.25), new MeshLambertMaterial({ color: '#20242c' }));
      wall.position.set(px, t.y0 - 0.2, pz); wall.rotation.y = s.ry;
      group.add(wall);
    }
    // tetto a sbalzo
    const lastT = tiers[1];
    const [rx, rz] = s.pos(lastT.start + lastT.rows * lastT.depth * 0.45);
    const roof = new Mesh(new BoxGeometry(s.len + 50, 0.5, lastT.rows * lastT.depth + 12), roofMat);
    roof.position.set(rx, lastT.y0 + lastT.rows * lastT.rise + 6, rz); roof.rotation.y = s.ry;
    roof.rotation.x = s.ry === 0 ? 0.08 : s.ry === Math.PI ? -0.08 : 0;
    group.add(roof);
    // muro di fondo
    const [bx, bz] = s.pos(lastT.start + lastT.rows * lastT.depth + 0.5);
    const back = new Mesh(new BoxGeometry(s.len + 50, lastT.y0 + lastT.rows * lastT.rise + 6, 0.6), concrete);
    back.position.set(bx, (lastT.y0 + lastT.rows * lastT.rise + 6) / 2, bz); back.rotation.y = s.ry;
    group.add(back);
  }
  crowd.count = idx;
  seats.count = sidx;
  crowd.geometry.setAttribute('aFan', new InstancedBufferAttribute(aFan, 1));
  crowd.geometry.setAttribute('aPhase', new InstancedBufferAttribute(aPhase, 1));
  group.add(seats, crowd);
  return { uniforms };
}

// ------------------------------------------------------------------ BANDIERE
export interface Waving { update(t: number): void }

function flagTexture(colors: string[], vertical = true) {
  const c = canvas(96, 64), ctx = c.getContext('2d')!;
  colors.forEach((col, i) => {
    ctx.fillStyle = col;
    if (vertical) ctx.fillRect((i * 96) / colors.length, 0, 96 / colors.length + 1, 64);
    else ctx.fillRect(0, (i * 64) / colors.length, 96, 64 / colors.length + 1);
  });
  return tex(c);
}

/** Bandiere che sventolano sul bordo del secondo anello */
export function buildFlags(group: Group, teamColors: string[][]): Waving {
  const mats: MeshStandardMaterial[] = [];
  const uTime = { value: 0 };
  const geo = new PlaneGeometry(3.2, 2.1, 12, 6);
  geo.translate(1.6, 0, 0);
  const all = [['#009246', '#ffffff', '#ce2b37'], ...teamColors];
  all.forEach((cols) => {
    const m = new MeshStandardMaterial({ map: flagTexture(cols, cols.length === 3), side: DoubleSide, roughness: 0.8 });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float w = position.x / 3.2;
        transformed.z += sin(uTime * 4.0 + position.x * 2.2) * 0.28 * w;
        transformed.y += sin(uTime * 3.0 + position.x * 1.5) * 0.08 * w;`);
    };
    mats.push(m);
  });
  const L = FIELD.halfLength + 8, H = FIELD.halfWidth + 7;
  const y = 14 * 0.42 + 4.2 + 0.4;
  const front = 14 * 0.82 + 3.0;
  let k = 0;
  for (let x = -L; x <= L; x += 9) {
    for (const sz of [-1, 1]) {
      const f = new Mesh(geo, mats[k++ % mats.length]);
      f.position.set(x, y, sz * (H + front));
      f.rotation.y = sz > 0 ? Math.PI : 0;
      group.add(f);
    }
  }
  for (let z = -H + 4; z <= H - 4; z += 9) {
    const f = new Mesh(geo, mats[k++ % mats.length]);
    f.position.set(L + front, y, z); f.rotation.y = -Math.PI / 2;
    group.add(f);
  }
  return { update: (t) => { uTime.value = t; } };
}

// ------------------------------------------------------------------ LED
/** Cartelloni LED luminosi a bordo campo con messaggi che scorrono (originali, nessun marchio) */
export function buildLED(group: Group): Waving {
  const c = canvas(2048, 64), ctx = c.getContext('2d')!;
  const msgs = [['FORZA ANDREA!', '#e63946'], ['ANDREA FOOTBALL CHAMPIONS', '#1d3557'], ['GOL! GOL! GOL!', '#f77f00'], ['SEI UN CAMPIONE!', '#2a9d8f'], ['DISEGNA IL TIRO!', '#7b2ff7'], ['VAI ANDREA!', '#0077b6'], ['CHE PARTITA!', '#d62828'], ['⚽ ⚽ ⚽', '#2b9348']];
  msgs.forEach(([t, col], i) => {
    const x = i * 256;
    const g = ctx.createLinearGradient(x, 0, x + 256, 64);
    g.addColorStop(0, col); g.addColorStop(1, '#0b0b1a');
    ctx.fillStyle = g; ctx.fillRect(x, 0, 256, 64);
    ctx.fillStyle = '#fff'; ctx.font = 'italic 900 26px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t, x + 128, 33, 236);
  });
  // effetto pixel LED
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let x = 0; x < 2048; x += 3) ctx.fillRect(x, 0, 1, 64);
  const texs: CanvasTexture[] = [];
  const L = FIELD.halfLength, H = FIELD.halfWidth;
  const mk = (len: number, x: number, z: number, ry: number) => {
    const t = tex(c); t.wrapS = RepeatWrapping; t.repeat.set(len / 32, 1); texs.push(t);
    const m = new Mesh(new BoxGeometry(len, 0.95, 0.15), [
      new MeshBasicMaterial({ color: '#111' }), new MeshBasicMaterial({ color: '#111' }), new MeshBasicMaterial({ color: '#111' }),
      new MeshBasicMaterial({ color: '#111' }), new MeshBasicMaterial({ map: t }), new MeshBasicMaterial({ color: '#111' })
    ]);
    m.position.set(x, 0.48, z); m.rotation.y = ry;
    group.add(m);
  };
  mk(L * 2 + 8, 0, -H - 3.5, 0);
  mk(L * 2 + 8, 0, H + 3.5, Math.PI);
  mk(H * 2 + 6, L + 4.5, 0, -Math.PI / 2);
  mk(H * 2 + 6, -L - 4.5, 0, Math.PI / 2);
  return { update: (t) => { const o = (t * 0.04) % 1; texs.forEach((x) => { x.offset.x = o; }); } };
}

// ------------------------------------------------------------------ PANCHINE E DETTAGLI
export function buildDetails(group: Group) {
  const L = FIELD.halfLength, H = FIELD.halfWidth;
  const benchMat = new MeshStandardMaterial({ color: '#9fb4c7', transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.2 });
  const seat = new MeshLambertMaterial({ color: '#c1121f' });
  for (const x of [-12, 12]) {
    const roof = new Mesh(new BoxGeometry(8, 0.08, 1.6), benchMat);
    roof.position.set(x, 2.3, -H - 2); group.add(roof);
    const backW = new Mesh(new BoxGeometry(8, 2.3, 0.08), benchMat);
    backW.position.set(x, 1.15, -H - 2.8); group.add(backW);
    const s = new Mesh(new BoxGeometry(7.6, 0.5, 0.6), seat);
    s.position.set(x, 0.25, -H - 2.4); group.add(s);
  }
  // bandierine del calcio d'angolo
  const pole = new BoxGeometry(0.04, 1.5, 0.04);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const p = new Mesh(pole, new MeshLambertMaterial({ color: '#fff' }));
    p.position.set(sx * L, 0.75, sz * H); group.add(p);
    const f = new Mesh(new PlaneGeometry(0.4, 0.3), new MeshLambertMaterial({ color: '#ffd23f', side: DoubleSide }));
    f.position.set(sx * L + 0.2, 1.35, sz * H); group.add(f);
  }
  // fascia di erba scura attorno al campo (pista)
  void BufferAttribute;
}
