import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Élément #root introuvable');

// Pas de StrictMode : le double-montage des effets en dev rejoue l'init impérative
// de Leaflet et les abonnements IPC (window.engine, sans API de désabonnement),
// ce qui provoque doublons/races. Voir docs/decisions.md (2026-06-28).
createRoot(root).render(<App />);
