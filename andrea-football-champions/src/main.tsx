import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './ui/App';
import './ui/styles.css';

// Service worker per l'uso offline (dopo il primo caricamento)
if ('serviceWorker' in navigator) registerSW({ immediate: true });
// Rimuove la cache di eventuali giochi precedenti pubblicati allo stesso indirizzo (es. Memory Kids)
if ('caches' in window) caches.keys().then((ks) => ks.filter((k) => !k.startsWith('workbox')).forEach((k) => caches.delete(k))).catch(() => {});

// Blocca il doppio tocco/zoom su iOS
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

createRoot(document.getElementById('root')!).render(<App />);
