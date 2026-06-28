import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Pas de StrictMode : le double-montage des effets en dev rejoue l'init impérative
// de Leaflet et les abonnements IPC (window.engine, sans API de désabonnement),
// ce qui provoque doublons/races. Voir docs/decisions.md (2026-06-28).
createRoot(document.getElementById('root')).render(<App />);
