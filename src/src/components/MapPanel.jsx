import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Modal from './Modal.jsx';
import './MapPanel.css';

const TILE_LAYERS = {
  plan: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 },
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: { attribution: 'Tiles &copy; Esri', maxZoom: 19 },
  },
};

const DEFAULT_CENTER = [46.8, 2.5];
const DEFAULT_ZOOM = 6;
const MIN_ZONE_SIZE_METERS = 10;
const MAX_ZONE_AREA_KM2 = 120;

function computeAreaKm2(bounds) {
  const nw = bounds.getNorthWest();
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  const widthM = nw.distanceTo(ne);
  const heightM = nw.distanceTo(sw);
  return (widthM * heightM) / 1e6;
}

function formatArea(areaKm2) {
  if (areaKm2 < 1) return `${Math.round(areaKm2 * 100) / 100} km²`;
  return `${areaKm2.toFixed(1)} km²`;
}

function formatBounds(bounds) {
  return `${bounds.south.toFixed(4)}, ${bounds.west.toFixed(4)} → ${bounds.north.toFixed(4)}, ${bounds.east.toFixed(4)}`;
}

function formatSuggestion(result) {
  const address = result.address || {};
  const city = address.city || address.town || address.village || address.municipality || address.county;
  const country = address.country;
  if (city && country) return `${city}, ${country}`;
  return city || country || result.display_name;
}

export default function MapPanel({ mapLayer, onLayerChange, zone, onZoneChange }) {
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const rectangleRef = useRef(null);
  const drawStateRef = useRef({ drawing: false, start: null });

  const [interactionMode, setInteractionMode] = useState(null); // null | 'draw'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchStatus, setSearchStatus] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showAreaErrorModal, setShowAreaErrorModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Initialize the map once.
  useEffect(() => {
    const map = L.map(mapElRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: false,
    });
    mapRef.current = map;

    L.control.scale({ metric: true, imperial: false }).addTo(map);

    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Switch tile layer (plan / satellite).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
    const config = TILE_LAYERS[mapLayer] ?? TILE_LAYERS.plan;
    tileLayerRef.current = L.tileLayer(config.url, config.options).addTo(map);
  }, [mapLayer]);

  // Zone drawing (click-drag rectangle).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const drawMode = interactionMode === 'draw';

    const onMouseDown = (event) => {
      if (!drawMode) return;
      drawStateRef.current = { drawing: true, start: event.latlng };
      if (rectangleRef.current) {
        map.removeLayer(rectangleRef.current);
        rectangleRef.current = null;
      }
      map.dragging.disable();
    };

    const onMouseMove = (event) => {
      if (!drawStateRef.current.drawing) return;
      const bounds = L.latLngBounds(drawStateRef.current.start, event.latlng);
      if (rectangleRef.current) {
        rectangleRef.current.setBounds(bounds);
      } else {
        rectangleRef.current = L.rectangle(bounds, { className: 'zone-rectangle' }).addTo(map);
      }
    };

    const onMouseUp = (event) => {
      if (!drawStateRef.current.drawing) return;
      drawStateRef.current.drawing = false;
      map.dragging.enable();

      const bounds = L.latLngBounds(drawStateRef.current.start, event.latlng);
      const isLargeEnough = bounds.getNorthEast().distanceTo(bounds.getSouthWest()) > MIN_ZONE_SIZE_METERS;
      const areaKm2 = computeAreaKm2(bounds);

      if (isLargeEnough && areaKm2 > MAX_ZONE_AREA_KM2) {
        if (rectangleRef.current) {
          map.removeLayer(rectangleRef.current);
          rectangleRef.current = null;
        }
        setShowAreaErrorModal(true);
      } else if (isLargeEnough) {
        if (rectangleRef.current) {
          rectangleRef.current.setBounds(bounds);
        } else {
          rectangleRef.current = L.rectangle(bounds, { className: 'zone-rectangle' }).addTo(map);
        }
        onZoneChange({
          bounds: {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest(),
          },
          areaKm2,
        });
      } else if (rectangleRef.current) {
        map.removeLayer(rectangleRef.current);
        rectangleRef.current = null;
      }

      setInteractionMode(null);
    };

    map.on('mousedown', onMouseDown);
    map.on('mousemove', onMouseMove);
    map.on('mouseup', onMouseUp);

    return () => {
      map.off('mousedown', onMouseDown);
      map.off('mousemove', onMouseMove);
      map.off('mouseup', onMouseUp);
    };
  }, [interactionMode, onZoneChange]);

  // Cursor feedback for the active interaction mode.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getContainer().style.cursor = interactionMode ? 'crosshair' : '';
  }, [interactionMode]);

  // Keep the rectangle layer in sync if the zone is cleared externally.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!zone && rectangleRef.current) {
      map.removeLayer(rectangleRef.current);
      rectangleRef.current = null;
    }
  }, [zone]);

  const toggleDrawMode = useCallback(() => {
    setInteractionMode((mode) => (mode === 'draw' ? null : 'draw'));
    setSearchStatus('');
  }, []);

  const performReset = useCallback(() => {
    onZoneChange(null);
    setInteractionMode(null);
    setSearchStatus('');
  }, [onZoneChange]);

  const handleReset = useCallback(() => {
    if (zone) {
      setShowResetConfirm(true);
      return;
    }
    performReset();
  }, [zone, performReset]);

  const handleSearch = useCallback(async (event) => {
    event.preventDefault();
    setShowSuggestions(false);
    const query = searchQuery.trim();
    if (!query) return;

    setSearchStatus('Recherche…');
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
      const response = await fetch(url, { headers: { 'Accept-Language': 'fr' } });
      const results = await response.json();
      if (results && results[0]) {
        const { boundingbox } = results[0];
        const bounds = L.latLngBounds(
          [parseFloat(boundingbox[0]), parseFloat(boundingbox[2])],
          [parseFloat(boundingbox[1]), parseFloat(boundingbox[3])],
        );
        mapRef.current.fitBounds(bounds, { maxZoom: 14 });
        setSearchStatus('');
      } else {
        setSearchStatus('Aucun résultat trouvé.');
      }
    } catch {
      setSearchStatus('Recherche indisponible (vérifiez votre connexion).');
    }
  }, [searchQuery]);

  // Live address suggestions as the user types (debounced).
  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`;
        const response = await fetch(url, { headers: { 'Accept-Language': 'fr' } });
        const results = await response.json();
        const list = Array.isArray(results) ? results : [];
        const seen = new Set();
        const deduped = list.filter((result) => {
          const label = formatSuggestion(result);
          if (seen.has(label)) return false;
          seen.add(label);
          return true;
        });
        setSuggestions(deduped);
      } catch {
        setSuggestions([]);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const selectSuggestion = useCallback((result) => {
    const { boundingbox } = result;
    const bounds = L.latLngBounds(
      [parseFloat(boundingbox[0]), parseFloat(boundingbox[2])],
      [parseFloat(boundingbox[1]), parseFloat(boundingbox[3])],
    );
    mapRef.current.fitBounds(bounds, { maxZoom: 14 });
    setSearchQuery(formatSuggestion(result));
    setSuggestions([]);
    setShowSuggestions(false);
    setSearchStatus('');
  }, []);

  return (
    <section className="panel panel--map">
      <div className="panel__header">
        <h2><span className="step">1</span>Choisissez votre zone de simulation</h2>
        <p className="panel__hint">
          Recherchez un lieu et dessinez la zone d'étude sur la carte.
        </p>
      </div>

      <div className="map-toolbar">
        <form className="search-field" onSubmit={handleSearch}>
          <svg className="search-field__icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
            placeholder="Rechercher une ville, un lieu-dit…"
            autoComplete="off"
          />
          <button type="submit">Rechercher</button>
          {showSuggestions && suggestions.length > 0 && (
            <ul className="search-suggestions">
              {suggestions.map((result) => (
                <li key={result.place_id}>
                  <button type="button" onMouseDown={(event) => { event.preventDefault(); selectSuggestion(result); }}>
                    {result.address?.country_code && (
                      <img
                        className="search-suggestions__flag"
                        src={`https://flagcdn.com/24x18/${result.address.country_code}.png`}
                        alt=""
                        width="22"
                        height="16"
                      />
                    )}
                    {formatSuggestion(result)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>

        <div className="map-tools">
          <button
            type="button"
            className="tool-btn"
            onClick={() => onLayerChange(mapLayer === 'plan' ? 'satellite' : 'plan')}
            title={mapLayer === 'satellite' ? 'Revenir au fond de carte plan' : 'Passer en vue satellite'}
          >
            {mapLayer === 'satellite' ? (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                <line x1="8" y1="2" x2="8" y2="18" />
                <line x1="16" y1="6" x2="16" y2="22" />
              </svg>
            )}
            {mapLayer === 'satellite' ? 'Vue plan' : 'Vue satellite'}
          </button>
          <button
            type="button"
            className={`tool-btn${interactionMode === 'draw' ? ' is-active' : ''}`}
            onClick={toggleDrawMode}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2" strokeDasharray="4 3" /></svg>
            Dessiner la zone
          </button>
          <button type="button" className="tool-btn tool-btn--danger" onClick={handleReset}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" /><path d="M3 3v5h5" /></svg>
            Réinitialiser
          </button>
        </div>
      </div>

      {searchStatus && <p className="map-status">{searchStatus}</p>}

      <div ref={mapElRef} className="map" />

      <dl className="zone-summary">
        <div className="zone-summary__item">
          <dt>Surface <span className="required">*</span></dt>
          <dd>{zone ? formatArea(zone.areaKm2) : '—'}</dd>
        </div>
        <div className="zone-summary__item">
          <dt>Emprise (lat / lon)</dt>
          <dd>{zone ? formatBounds(zone.bounds) : '—'}</dd>
        </div>
      </dl>

      <Modal
        open={showAreaErrorModal}
        title="Zone trop grande"
        onClose={() => setShowAreaErrorModal(false)}
      >
        La zone sélectionnée est trop grande. La surface maximale autorisée est de {MAX_ZONE_AREA_KM2} km².
      </Modal>

      <Modal
        open={showResetConfirm}
        title="Réinitialiser"
        onClose={() => setShowResetConfirm(false)}
        onConfirm={() => {
          performReset();
          setShowResetConfirm(false);
        }}
        confirmLabel="Réinitialiser"
        confirmDanger
      >
        Voulez-vous vraiment réinitialiser la zone de simulation ?
      </Modal>
    </section>
  );
}
