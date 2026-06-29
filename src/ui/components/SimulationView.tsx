import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CellState } from '../../../engine/types';
import type { Weather } from '../../../engine/types';
import { hexToPixel } from '../../../engine/hexUtils';
import type { StateMsg, WorkerOutMsg } from '../../../engine/protocol';
import { boundsToGrid, latLngToCell, pixelToLatLng, GridGeo } from '../../domain/geoGrid';
import { buildTerrainRaster, sampleGridTerrain } from '../lib/terrainRaster';
import type { SimParams, Zone } from '../types/sim';
import './SimulationView.css';

const STEP_MIN = 3;        // minutes simulées par tick (affichage)
const SPEEDS = [1, 2, 5];
const RADIUS = 12;         // rayon de la grille hexagonale
const SEED = 0xdeadbeef;   // graine déterministe de la simulation

const FIRE_COLOR = '#f5921e';
const BURNED_COLOR = '#c06228';

const TOOLS = [
  { id: 'feu', label: 'Feu', icon: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
    </svg>
  ) },
  { id: 'vegetation', label: 'Végétation', icon: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
    </svg>
  ) },
  { id: 'dessiner', label: 'Dessiner', icon: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
    </svg>
  ) },
  { id: 'vent', label: 'Vent', icon: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>
    </svg>
  ) },
  { id: 'donnees', label: 'Données', icon: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  ) },
  { id: 'effacer', label: 'Effacer', icon: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
    </svg>
  ) },
];

const LEGEND_ITEMS = [
  { color: FIRE_COLOR, label: 'Foyer actif' },
  { color: BURNED_COLOR, label: 'Zone brûlée' },
  { color: '#3d6bbf', label: 'Eau' },
  { color: '#245218', label: 'Forêt' },
  { color: '#508820', label: 'Garrigue / lande' },
  { color: '#88c040', label: 'Prairie / herbe' },
  { color: '#c8a840', label: 'Cultures' },
  { color: '#a09080', label: 'Roche / minéral' },
  { color: '#c0bcd0', label: 'Zone résidentielle' },
  { color: '#9898a8', label: 'Zone industrielle' },
];

function formatHHMM(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function degToCardinalFR(deg: number): string {
  const dirs = ['Nord', 'Nord-Est', 'Est', 'Sud-Est', 'Sud', 'Sud-Ouest', 'Ouest', 'Nord-Ouest'];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8] ?? 'Nord';
}

// Extrait du SimParams les 5 champs météo consommés par le moteur (convention météo conservée).
function paramsToWeather(p: SimParams): Weather {
  return {
    windDirection: p.windDirection,
    windSpeed:     p.windSpeed,
    temperature:   p.temperature,
    humidity:      p.humidity,
    fuelMoisture:  p.fuelMoisture,
  };
}

// Les 6 coins (lat/lon) d'une cellule hexagonale pointy-top.
function hexCorners(geo: GridGeo, q: number, r: number): [number, number][] {
  const c = hexToPixel(q, r, 1);
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const ang = (Math.PI / 180) * (60 * i - 30);
    const { lat, lng } = pixelToLatLng(geo, c.x + Math.cos(ang), c.y + Math.sin(ang));
    pts.push([lat, lng]);
  }
  return pts;
}

interface SimulationViewProps {
  zone: Zone | null;
  params: SimParams;
  onExit: () => void;
}

export default function SimulationView({ zone, params, onExit }: SimulationViewProps) {
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const zoneBoundsRef = useRef<L.LatLngBounds | null>(null);
  const geoRef = useRef<GridGeo | null>(null);
  const isPlayingRef = useRef(false);
  const lastTickRef = useRef(0);

  const [mapReady, setMapReady] = useState(false);
  const [engineState, setEngineState] = useState<StateMsg | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [activeTool, setActiveTool] = useState('feu');
  const [terrainURL, setTerrainURL] = useState<string | null>(null);
  const [terrainLoading, setTerrainLoading] = useState(false);

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  // ── Données dérivées de l'état moteur ───────────────────────────────────
  const tick = engineState?.tick ?? 0;
  const tickMax = engineState?.tickMax ?? 0;
  const cells = engineState?.cells ?? [];
  const onFire = cells.filter((c) => c.state === CellState.ON_FIRE).length;
  const burned = cells.filter((c) => c.state === CellState.BURNED).length;
  const totalCells = cells.length || 1;
  const elapsedMin = tick * STEP_MIN;
  const totalMin = tickMax * STEP_MIN;
  const progress = tickMax > 0 ? (tick / tickMax) * 100 : 0;
  const areaBurned = (((burned + onFire) / totalCells) * (zone?.areaKm2 ?? 10)).toFixed(2);
  const windDir = params.windDirection ?? 0;
  const windSpeed = params.windSpeed ?? 0;
  const fuelMoisture = params.fuelMoisture ?? 12;

  const sendForward = () => window.engine?.send({ type: 'navigate', direction: 'forward' });
  const sendJump = (t: number) => window.engine?.send({ type: 'navigate', direction: 'jump', tick: t });
  const sendBackward = () => window.engine?.send({ type: 'navigate', direction: 'backward' });

  const handleFitZone = () => {
    if (mapRef.current && zoneBoundsRef.current) {
      mapRef.current.fitBounds(zoneBoundsRef.current, { padding: [50, 50], animate: true });
    }
  };

  const handleDownload = async () => {
    const el = mapElRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    await window.capture?.map(
      { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
      params.simName || 'zone',
    );
  };

  // ── Effet 1 : init carte Leaflet ────────────────────────────────────────
  useEffect(() => {
    if (!mapElRef.current) return;
    const map = L.map(mapElRef.current, { attributionControl: false, zoomControl: false, maxBoundsViscosity: 1.0 });
    mapRef.current = map;

    if (zone) {
      const bounds = L.latLngBounds([zone.bounds.south, zone.bounds.west], [zone.bounds.north, zone.bounds.east]);
      zoneBoundsRef.current = bounds;
      map.fitBounds(bounds, { padding: [50, 50] });
      map.setMaxBounds(bounds.pad(0.08));
    } else {
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
      map.setView([46.8, 2.5], 6);
    }
    setMapReady(true);
    return () => { map.remove(); mapRef.current = null; setMapReady(false); };
  }, [zone]);

  // ── Effet 2 : abonnement moteur + init + raster terrain + remplissage ────
  useEffect(() => {
    if (!zone) return;
    let alive = true;
    const geo = boundsToGrid(zone.bounds, RADIUS);
    geoRef.current = geo;

    const handler = (msg: WorkerOutMsg) => {
      if (!alive || msg.type !== 'state') return;
      setEngineState(msg);
      if (isPlayingRef.current && msg.tick === lastTickRef.current) setIsPlaying(false);
      lastTickRef.current = msg.tick;
    };
    window.engine?.onMessage(handler);
    window.engine?.send({ type: 'init', radius: RADIUS, seed: SEED });
    // La météo est envoyée juste après par l'effet 2b (setWeather), puis à chaque changement.

    setTerrainLoading(true);
    buildTerrainRaster(zone)
      .then((raster) => {
        if (!alive) return;
        setTerrainURL(raster.url);
        setTerrainLoading(false);
        window.engine?.send({ type: 'loadTerrain', cells: sampleGridTerrain(raster, geo) });
      })
      .catch(() => { if (alive) setTerrainLoading(false); });

    // window.engine n'expose pas de désabonnement : le flag `alive` neutralise
    // le handler après démontage (voir docs/decisions.md).
    return () => { alive = false; };
  }, [zone]);

  // ── Effet 2b : mise à jour de la météo moteur quand les paramètres changent ──
  // (Invalide les ticks > tick courant, régénérés à la demande.)
  useEffect(() => {
    if (!zone) return;
    window.engine?.send({ type: 'setWeather', weather: paramsToWeather(params) });
  }, [zone, params]);

  // ── Effet 3 : overlay terrain (raster) ──────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !terrainURL || !zoneBoundsRef.current) return;
    const overlay = L.imageOverlay(terrainURL, zoneBoundsRef.current, { opacity: 1, interactive: false, className: 'sim-terrain' }).addTo(mapRef.current);
    return () => { overlay.remove(); };
  }, [terrainURL]);

  // ── Effet 4 : couche feu (hexagones ON_FIRE / BURNED) ───────────────────
  useEffect(() => {
    const map = mapRef.current, geo = geoRef.current;
    if (!map || !geo || !mapReady) return;
    const group = L.layerGroup();
    for (const cell of cells) {
      if (cell.state === CellState.INTACT) continue;
      const onFireCell = cell.state === CellState.ON_FIRE;
      L.polygon(hexCorners(geo, cell.q, cell.r), {
        stroke: false,
        fillColor: onFireCell ? FIRE_COLOR : BURNED_COLOR,
        fillOpacity: onFireCell ? 0.78 : 0.55,
        interactive: false,
      }).addTo(group);
    }
    group.addTo(map);
    return () => { group.remove(); };
  }, [engineState, mapReady]);

  // ── Effet 5 : clic carte → outil actif ──────────────────────────────────
  useEffect(() => {
    const map = mapRef.current, geo = geoRef.current;
    if (!map || !geo || !mapReady) return;
    const onClick = (e: L.LeafletMouseEvent) => {
      const { id } = latLngToCell(geo, e.latlng.lat, e.latlng.lng);
      if (activeTool === 'feu') window.engine?.send({ type: 'ignite', id });
    };
    map.on('click', onClick);
    return () => { map.off('click', onClick); };
  }, [activeTool, mapReady]);

  // ── Effet 6 : lecture (navigate forward cadencé) ────────────────────────
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(sendForward, 800 / speed);
    return () => clearInterval(interval);
  }, [isPlaying, speed]);

  return (
    <div className="sim-view">
      <div ref={mapElRef} className="sim-map" />

      <div className="sim-hud">

        {/* ── Top-left: Stats ── */}
        <div className="sim-stats-panel">
          <div className="sim-stats-panel__header">
            <span className="sim-stats-panel__title">SIMULATION EN COURS</span>
            <span className="sim-stats-panel__timer">T+{formatHHMM(elapsedMin)}</span>
          </div>
          <ul className="sim-stat-list">
            <li><span>Surface brûlée</span><span className="val-accent">{areaBurned} km²</span></li>
            <li><span>Foyers actifs</span><span className="val-accent">{onFire}</span></li>
            <li><span>Direction</span><span className="val-bold">{windDir}° {degToCardinalFR(windDir)}</span></li>
            <li><span>Température</span><span className="val-bold">{params.temperature ?? 28} °C</span></li>
            <li>
              <span>Humidité combus.</span>
              <span className={fuelMoisture < 15 ? 'val-warn' : 'val-bold'}>
                {fuelMoisture}%
                {fuelMoisture < 15 && (
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4, verticalAlign: 'middle' }}>
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                )}
              </span>
            </li>
          </ul>
        </div>

        {/* ── Terrain loading indicator ── */}
        {terrainLoading && (
          <div className="sim-terrain-loading">
            <span className="sim-terrain-loading__dot" />
            Chargement du terrain…
          </div>
        )}

        {/* ── Top-right: Map controls ── */}
        <div className="sim-map-controls">
          <button className="sim-map-btn" title="Options">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
          </button>
          <button className="sim-map-btn" onClick={() => mapRef.current?.zoomOut()} title="Zoom arrière">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button className="sim-map-btn" onClick={handleFitZone} title="Recentrer sur la zone">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
          <button className="sim-map-btn" onClick={handleDownload} title="Télécharger la carte">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
        </div>

        {/* ── Bottom ── */}
        <div className="sim-bottom">

          {/* Left: Legend + home */}
          <div className="sim-bottom-left">
            <div className="sim-legend">
              <p className="sim-legend__title">LÉGENDE</p>
              {LEGEND_ITEMS.map(({ color, label }) => (
                <div key={label} className="sim-legend__item">
                  <span className="sim-legend__dot" style={{ background: color }} />
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <button className="sim-home-btn" onClick={onExit} title="Retour à l'accueil">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
            </button>
          </div>

          {/* Center: Bars */}
          <div className="sim-bottom-center">

            {/* Bar 1 — Playback */}
            <div className="sim-bar sim-bar--playback">
              <div className="sim-progress">
                <span className="sim-progress__cur">T+ <em>{formatHHMM(elapsedMin)}</em></span>
                <div className="sim-progress__track">
                  <div className="sim-progress__fill" style={{ width: `${progress}%` }} />
                  <input
                    type="range"
                    className="sim-progress__input"
                    min={0}
                    max={Math.max(tickMax, 1)}
                    value={tick}
                    onChange={(e) => { setIsPlaying(false); sendJump(Number(e.target.value)); }}
                  />
                </div>
                <span className="sim-progress__total">/ {formatHHMM(totalMin)}</span>
              </div>

              <div className="sim-playback">
                <button className="sim-ctl" onClick={() => { setIsPlaying(false); sendJump(0); }} title="Début">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
                </button>
                <button className="sim-ctl" onClick={() => { setIsPlaying(false); sendBackward(); }} title="Reculer d'un pas">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6 8.5 6V6l-8.5 6z"/></svg>
                </button>
                <button className="sim-ctl sim-ctl--play" onClick={() => setIsPlaying((v) => !v)} title={isPlaying ? 'Pause' : 'Lancer'}>
                  {isPlaying
                    ? <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                    : <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>}
                </button>
                <button className="sim-ctl" onClick={() => { setIsPlaying(false); sendForward(); }} title="Avancer d'un pas">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
                </button>
                <button className="sim-ctl" onClick={() => { setIsPlaying(false); sendJump(tickMax); }} title="Dernier tick généré">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                </button>

                <div className="sim-speeds">
                  {SPEEDS.map((s) => (
                    <button key={s} className={`sim-speed${speed === s ? ' is-active' : ''}`} onClick={() => setSpeed(s)}>×{s}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bar 2 — Tools */}
            <div className="sim-bar sim-bar--tools">
              {TOOLS.map((tool) => (
                <button
                  key={tool.id}
                  className={`sim-tool${activeTool === tool.id ? ' is-active' : ''}`}
                  onClick={() => setActiveTool(tool.id)}
                  title={tool.label}
                >
                  <span className="sim-tool__icon">{tool.icon}</span>
                  <span className="sim-tool__label">{tool.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Wind card */}
          <div className="sim-wind">
            <p className="sim-wind__title">VENT</p>
            <div className="sim-wind__rose">
              <div className="sim-wind__arrow" style={{ transform: `rotate(${windDir}deg)` }}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="6 10 12 4 18 10"/></svg>
              </div>
            </div>
            <span className="sim-wind__speed">{windSpeed} <span className="sim-wind__unit">km/h</span></span>
            <span className="sim-wind__deg">{windDir}°</span>
            <span className="sim-wind__cardinal">{degToCardinalFR(windDir)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
