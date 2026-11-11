// Service worker: salva il gioco sul telefono così funziona anche senza internet.
// Quando modifichi i file, aumenta il numero di versione per aggiornare l'app.
const CACHE = 'giardino-v1';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icone/icona-180.png',
  './icone/icona-192.png',
  './icone/icona-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Prima prova la rete (per ricevere gli aggiornamenti), se non c'è internet usa la copia salvata.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
  );
});
