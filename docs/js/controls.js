// Controlli: joystick virtuale (compare dove il bambino tocca), pulsanti grandi, tastiera.
export const input = {
  x: 0, y: 0,            // direzione joystick (-1..1), y positivo = verso il basso dello schermo
  sprint: false,
  shootHeld: false, shootHoldT: 0,
  pass: false, shoot: false, shootPower: 0, switch: false, any: false, tap: false,
  mouseActive: false, mouseX: 0, mouseY: 0, mouseOverUI: false,
  clearEdges() { this.pass = this.shoot = this.switch = this.any = this.tap = false; }
};

let joyEl, knobEl, zoneEl, active = null, center = { x: 0, y: 0 }, radius = 60;
const keys = new Set();
let shootStart = 0, mouseShoot = false;

export function setupControls(root) {
  zoneEl = root.querySelector('#joyZone');
  joyEl = root.querySelector('#joy');
  knobEl = root.querySelector('#joyKnob');

  zoneEl.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return; // col mouse si gioca seguendo il puntatore (vedi sotto)
    if (active !== null) return;
    active = e.pointerId;
    zoneEl.setPointerCapture(e.pointerId);
    const r = zoneEl.getBoundingClientRect();
    radius = Math.max(45, Math.min(75, r.height * 0.18));
    center = { x: e.clientX, y: e.clientY };
    joyEl.style.left = (e.clientX - r.left) + 'px';
    joyEl.style.top = (e.clientY - r.top) + 'px';
    joyEl.classList.add('on');
    move(e);
    input.any = true; input.tap = true;
    e.preventDefault();
  });
  const move = e => {
    if (e.pointerId !== active) return;
    let dx = e.clientX - center.x, dy = e.clientY - center.y;
    const d = Math.hypot(dx, dy);
    if (d > radius) { dx *= radius / d; dy *= radius / d; }
    knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
    const m = Math.min(1, d / radius);
    const dead = 0.15;
    if (m < dead) { input.x = input.y = 0; }
    else { const sc = (m - dead) / (1 - dead); const dd = Math.hypot(dx, dy); input.x = dx / dd * sc; input.y = dy / dd * sc; }
  };
  zoneEl.addEventListener('pointermove', move);
  const end = e => {
    if (e.pointerId !== active) return;
    active = null; input.x = input.y = 0;
    knobEl.style.transform = 'translate(0px,0px)';
    joyEl.classList.remove('on');
  };
  zoneEl.addEventListener('pointerup', end);
  zoneEl.addEventListener('pointercancel', end);

  const btn = (sel, down, up) => {
    const b = root.querySelector(sel);
    if (!b) return;
    b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('pressed'); input.any = true; down(); if (navigator.vibrate) try { navigator.vibrate(12); } catch (_) {} });
    const u = e => { b.classList.remove('pressed'); up && up(); };
    b.addEventListener('pointerup', u); b.addEventListener('pointercancel', u);
    b.addEventListener('contextmenu', e => e.preventDefault());
  };
  btn('#btnShoot', () => { input.shootHeld = true; shootStart = performance.now(); }, () => releaseShoot());
  btn('#btnPass', () => { input.pass = true; });
  btn('#btnSprint', () => { input.sprint = true; }, () => { input.sprint = false; });
  btn('#btnSwitch', () => { input.switch = true; });

  // ---- MOUSE: il giocatore segue il puntatore, clic sinistro = TIRA (tieni premuto), clic destro = PASSA ----
  const inGame = () => root.classList.contains('active') && !document.querySelector('.overlay.on');
  const onField = t => t && (t.id === 'gl' || (t.closest && t.closest('#joyZone')));
  window.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    input.mouseX = e.clientX; input.mouseY = e.clientY;
    input.mouseOverUI = !onField(e.target);
    if (!keys.size) input.mouseActive = true;
  });
  document.addEventListener('mouseleave', () => { input.mouseActive = false; });
  window.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || !inGame() || !onField(e.target)) return;
    input.mouseX = e.clientX; input.mouseY = e.clientY; input.mouseActive = true; input.mouseOverUI = false;
    input.any = true; input.tap = true;
    if (e.button === 0) { input.shootHeld = true; shootStart = performance.now(); mouseShoot = true; }
    else if (e.button === 2) input.pass = true;
    e.preventDefault();
  });
  window.addEventListener('pointerup', e => {
    if (e.pointerType === 'mouse' && e.button === 0 && mouseShoot) { mouseShoot = false; releaseShoot(); }
  });
  window.addEventListener('contextmenu', e => { if (inGame()) e.preventDefault(); });

  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    keys.add(e.code); input.any = true;
    if (e.code === 'Space' || e.code === 'KeyK') { input.shootHeld = true; shootStart = performance.now(); }
    if (e.code === 'KeyJ' || e.code === 'KeyX') input.pass = true;
    if (e.code === 'KeyC' || e.code === 'KeyQ') input.switch = true;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyL') input.sprint = true;
    keyDir();
  });
  window.addEventListener('keyup', e => {
    keys.delete(e.code);
    if (e.code === 'Space' || e.code === 'KeyK') releaseShoot();
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyL') input.sprint = false;
    keyDir();
  });
}

function keyDir() {
  if (active !== null) return;
  if (keys.size) input.mouseActive = false;
  let x = 0, y = 0;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) x -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) x += 1;
  if (keys.has('ArrowUp') || keys.has('KeyW')) y -= 1;
  if (keys.has('ArrowDown') || keys.has('KeyS')) y += 1;
  const m = Math.hypot(x, y) || 1;
  input.x = x / m; input.y = y / m;
}

function releaseShoot() {
  if (!input.shootHeld) return;
  input.shootHeld = false;
  input.shoot = true;
  input.shootPower = Math.min(1, (performance.now() - shootStart) / 900);
}
export function shootCharge() { return input.shootHeld ? Math.min(1, (performance.now() - shootStart) / 900) : 0; }

export function resetInput() {
  input.x = input.y = 0; input.sprint = false; input.shootHeld = false; input.clearEdges();
  active = null; keys.clear();
  if (knobEl) knobEl.style.transform = 'translate(0px,0px)';
  if (joyEl) joyEl.classList.remove('on');
}
