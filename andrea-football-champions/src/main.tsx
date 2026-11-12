import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './ui/App';
import './ui/styles.css';

// Service worker per l'uso offline (dopo il primo caricamento)
if ('serviceWorker' in navigator) registerSW({ immediate: true });


// Blocca il doppio tocco/zoom su iOS
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

createRoot(document.getElementById('root')!).render(<App />);
