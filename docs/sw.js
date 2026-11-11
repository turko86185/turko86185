// Service worker: memorizza tutto il gioco sul dispositivo per giocare anche offline.
const VERSION = 'afc-v1';
const ASSETS = [
  './',
  'css/style.css',
  'data/teams.json',
  'fonts/fredoka-latin.woff2',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'index.html',
  'js/audio.js',
  'js/controls.js',
  'js/engine/actors.js',
  'js/engine/core.js',
  'js/engine/match.js',
  'js/engine/penalty.js',
  'js/engine/training.js',
  'js/engine/world.js',
  'js/league.js',
  'js/main.js',
  'js/store.js',
  'js/teams.js',
  'js/vendor/three.module.min.js',
  'manifest.webmanifest',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // copia locale subito (veloce e offline); in sottofondo si scarica l'eventuale versione aggiornata
  e.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || (await cache.match('index.html')) || Response.error();
  }));
});
