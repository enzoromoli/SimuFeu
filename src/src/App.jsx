import { useCallback, useEffect, useMemo, useState } from 'react';
import ThemeToggle from './components/ThemeToggle.jsx';
import MapPanel from './components/MapPanel.jsx';
import ParametersPanel from './components/ParametersPanel.jsx';
import SimulationView from './components/SimulationView.jsx';
import './App.css';

const THEME_STORAGE_KEY = 'simufeu-theme';

function getInitialTheme() {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' ? 'light' : 'dark';
}

function localDateTimeString() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function createInitialParams() {
  return {
    simName: '',
    simDate: localDateTimeString(),
    simDescription: '',
    windDirection: 0,
    windSpeed: 15,
    windGust: 25,
    temperature: 25,
    humidity: 40,
    vegetation: 'conifere',
    fuelMoisture: 12,
  };
}

export default function App() {
  const [params, setParams] = useState(createInitialParams);
  const [zone, setZone] = useState(null);
  const [mapLayer, setMapLayer] = useState('plan');
  const [theme, setTheme] = useState(getInitialTheme);
  const [view, setView] = useState('setup');
  const [nameError, setNameError] = useState(false);
  const [nameErrorKey, setNameErrorKey] = useState(0);
  const [debugMode, setDebugMode] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const updateParam = useCallback((key, value) => {
    setParams((prev) => ({ ...prev, [key]: value }));
    if (key === 'simName') setNameError(false);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'));
  }, []);

  const isValid = (Boolean(zone) || debugMode) && params.simName.trim().length > 0;
  const canValidate = Boolean(zone) || debugMode;

  const statusMessage = useMemo(() => {
    if (!zone) return 'Dessinez une zone de simulation sur la carte.';
    if (!params.simName.trim()) return 'Donnez un nom à votre simulation pour continuer.';
    return 'Configuration prête : vous pouvez lancer la simulation.';
  }, [zone, params.simName]);

  const handleValidate = () => {
    if (!zone && !debugMode) return;
    if (!params.simName.trim()) {
      setNameError(true);
      setNameErrorKey((k) => k + 1);
      return;
    }
    setNameError(false);
    window.engine?.send({ type: 'simulation:create', payload: { ...params, zone } });
    setView('simulation');
  };

  if (view === 'simulation') {
    return (
      <div className={`app-shell${theme === 'light' ? ' theme-light' : ''}`}>
        <SimulationView zone={zone} params={params} onExit={() => setView('setup')} />
      </div>
    );
  }

  return (
    <div className={`app-shell${theme === 'light' ? ' theme-light' : ''}`}>
      <main className="selection-card">
        <div className="selection-card__toolbar">
          <span className="brand">Pyro <span style={{ color: 'var(--accent)' }}>Pilot</span></span>
          <div className="toolbar-actions">
            <button
              type="button"
              className={`debug-toggle${debugMode ? ' debug-toggle--on' : ''}`}
              onClick={() => setDebugMode((v) => !v)}
              title="Désactiver la vérification de zone (debug)"
            >
              DEV
            </button>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </div>

        <div className="selection-card__grid">
          <MapPanel
            mapLayer={mapLayer}
            onLayerChange={setMapLayer}
            zone={zone}
            onZoneChange={setZone}
          />
          <ParametersPanel params={params} onChange={updateParam} zone={zone} nameError={nameError} nameErrorKey={nameErrorKey} debugMode={debugMode} />
        </div>

        <footer className="actions-bar">
          <div className="actions-bar__left">
            <p className={`actions-bar__status${isValid ? ' actions-bar__status--ready' : ''}`}>
              {!isValid && (
                <svg className="actions-bar__status-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              )}
              {statusMessage}
            </p>
            {zone && (
              <p className="actions-bar__required">
                <span className="required">*</span> obligatoire
              </p>
            )}
          </div>
          <button type="button" className="btn-primary" disabled={!canValidate} onClick={handleValidate}>
            Valider
          </button>
        </footer>
      </main>

    </div>
  );
}
