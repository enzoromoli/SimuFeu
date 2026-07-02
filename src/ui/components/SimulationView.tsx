import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CellState } from '../../../engine/types';
import { hexToPixel } from '../../../engine/gridUtils';
import type { StateMsg, WorkerOutMsg } from '../../../engine/protocol';
import { boundsToGrid, latLngToCell, pixelToLatLng, GridGeo } from '../../domain/geoGrid';
import { buildTerrainRaster, sampleGridTerrain } from '../lib/terrainRaster';
import { fetchFuelTanks } from '../lib/fuelTanks';
import { TILE_LAYERS } from '../lib/tileLayers';
import type { MapLayer, SimParams, Zone } from '../types/sim';
import './SimulationView.css';

const STEP_MIN = 3;        // minutes simulées par tick (affichage)
const SPEEDS = [1, 2, 5];
const TARGET_CELLS = 2500; // budget de cellules visé, quelle que soit la forme de la zone
const MIN_AXIS_RADIUS = 8;
const MAX_AXIS_RADIUS = 60;
const DEFAULT_RADIUS = 20; // utilisé si aucune zone n'est sélectionnée
const SEED = 0xdeadbeef;   // graine déterministe de la simulation

const FIRE_COLOR = '#f5921e';
const BURNED_COLOR = '#c06228';

const FLAME_ICON = L.divIcon({
  className: 'sim-flame-icon',
  html: '🔥',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

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

// Détermine la résolution (demi-largeur/demi-hauteur, en nombre de colonnes/lignes
// hexagonales) pour un budget de cellules ~constant, quelle que soit la forme de la
// zone : la grille (rectangle de cellules hexagonales) suit l'aspect réel du terrain
// (pas seulement en degrés).
function computeGridRadius(zone: Zone | null): { radiusX: number; radiusY: number } {
  if (!zone) return { radiusX: DEFAULT_RADIUS, radiusY: DEFAULT_RADIUS };
  const { north, south, east, west } = zone.bounds;
  const avgLatRad = ((north + south) / 2) * (Math.PI / 180);
  const heightM = (north - south) * 111_320;
  const widthM = (east - west) * 111_320 * Math.cos(avgLatRad);
  const aspect = Math.max(widthM, 1) / Math.max(heightM, 1);
  const rows = Math.sqrt(TARGET_CELLS / aspect);
  const cols = aspect * rows;
  const clamp = (v: number) => Math.round(Math.max(MIN_AXIS_RADIUS, Math.min(MAX_AXIS_RADIUS, v / 2)));
  return { radiusX: clamp(cols), radiusY: clamp(rows) };
}

interface SimulationViewProps {
  zone: Zone | null;
  params: SimParams;
  mapLayer: MapLayer;
  onExit: () => void;
}

export default function SimulationView({ zone, params, mapLayer, onExit }: SimulationViewProps) {
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const zoneBoundsRef = useRef<L.LatLngBounds | null>(null);
  const geoRef = useRef<GridGeo | null>(null);
  const isPlayingRef = useRef(false);
  const lastTickRef = useRef(0);
  const tanksRef = useRef<{ lat: number; lng: number; cellId: string }[]>([]);

  const [mapReady, setMapReady] = useState(false);
  const [engineState, setEngineState] = useState<StateMsg | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [activeTool, setActiveTool] = useState('feu');
  const [terrainLoading, setTerrainLoading] = useState(false);
  const [layer, setLayer] = useState<MapLayer>(mapLayer);
  const [panelsHidden, setPanelsHidden] = useState(false);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  // Panneaux masqués (bouton œil) et/ou capture d'écran en cours : dans les
  // deux cas, on ne garde que la carte + le feu, sans le HUD d'infos.
  const hideHud = panelsHidden || capturing;

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
    setCapturing(true);
    // Attend que le HUD ait bien disparu du rendu avant de capturer l'écran.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    try {
      const r = el.getBoundingClientRect();
      await window.capture?.map(
        { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
        params.simName || 'zone',
      );
    } finally {
      setCapturing(false);
    }
  };

  // ── Effet 1 : init carte Leaflet (vrai fond de carte, verrouillée sur la zone) ──
  useEffect(() => {
    if (!mapElRef.current) return;
    const map = L.map(mapElRef.current, { attributionControl: false, zoomControl: false, maxBoundsViscosity: 1.0 });
    mapRef.current = map;

    if (zone) {
      const bounds = L.latLngBounds([zone.bounds.south, zone.bounds.west], [zone.bounds.north, zone.bounds.east]);
      zoneBoundsRef.current = bounds;
      map.fitBounds(bounds, { padding: [50, 50], animate: false });
      // Impossible de quitter la zone sélectionnée : ni en déplaçant la carte,
      // ni en dézoomant au-delà du cadrage initial.
      map.setMaxBounds(bounds);
      map.setMinZoom(map.getZoom());
      L.rectangle(bounds, { className: 'sim-zone-outline', interactive: false }).addTo(map);
    } else {
      map.setView([46.8, 2.5], 6);
    }
    setMapReady(true);
    return () => { map.remove(); mapRef.current = null; tileLayerRef.current = null; setMapReady(false); };
  }, [zone]);

  // ── Effet 1b : fond de carte (plan / satellite), indépendant de l'init carte ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
    const tileConfig = TILE_LAYERS[layer] ?? TILE_LAYERS.plan;
    tileLayerRef.current = L.tileLayer(tileConfig.url, tileConfig.options).addTo(map);
  }, [layer, mapReady]);

  // ── Effet 2 : abonnement moteur + init + raster terrain + remplissage ────
  useEffect(() => {
    if (!zone) return;
    let alive = true;
    const { radiusX, radiusY } = computeGridRadius(zone);
    const geo = boundsToGrid(zone.bounds, radiusX, radiusY);
    geoRef.current = geo;
    tanksRef.current = [];

    const handler = (msg: WorkerOutMsg) => {
      if (!alive || msg.type !== 'state') return;
      setEngineState(msg);
      if (isPlayingRef.current && msg.tick === lastTickRef.current) setIsPlaying(false);
      lastTickRef.current = msg.tick;
    };
    window.engine?.onMessage(handler);
    window.engine?.send({ type: 'init', radiusX, radiusY, seed: SEED });

    setTerrainLoading(true);
    buildTerrainRaster(zone)
      .then((raster) => {
        if (!alive) return;
        setTerrainLoading(false);
        window.engine?.send({ type: 'loadTerrain', cells: sampleGridTerrain(raster, geo) });
      })
      .catch(() => { if (alive) setTerrainLoading(false); });

    // Tanks de carburant de la zone : purement visuel (animation d'explosion), voir
    // docs/decisions.md — aucun impact sur la simulation elle-même.
    // Overpass renvoie un `way` dès qu'un seul de ses nœuds touche la bbox demandée ;
    // son centroïde (`out center`) peut alors tomber EN DEHORS de la zone dessinée
    // (bâtiment qui déborde) — on écarte ces tanks hors-zone. Pour les tanks conservés,
    // on garde leur lat/lng RÉEL (pas le centre de la cellule hexagonale) : l'explosion
    // doit apparaître pile sur le réservoir, pas juste "dans la bonne cellule".
    fetchFuelTanks(zone.bounds).then((tanks) => {
      if (!alive) return;
      const { north, south, east, west } = zone.bounds;
      const inZone = tanks.filter((t) => t.lat >= south && t.lat <= north && t.lng >= west && t.lng <= east);
      tanksRef.current = inZone.map((t) => ({
        lat: t.lat,
        lng: t.lng,
        cellId: latLngToCell(geo, t.lat, t.lng).id,
      }));
    });

    // window.engine n'expose pas de désabonnement : le flag `alive` neutralise
    // le handler après démontage (voir docs/decisions.md).
    return () => { alive = false; };
  }, [zone]);

  // ── Effet 4 : grille hexagonale (terrain + feu / brûlé par-dessus) ──────
  useEffect(() => {
    const map = mapRef.current, geo = geoRef.current;
    if (!map || !geo || !mapReady || !engineState) return;
    const group = L.layerGroup();
    for (const cell of cells) {
      const onFireCell = cell.state === CellState.ON_FIRE;
      const burnedCell  = cell.state === CellState.BURNED;
      const fillColor = onFireCell ? FIRE_COLOR : burnedCell ? BURNED_COLOR : engineState.terrainConfig[cell.terrain].color;
      const fillOpacity = onFireCell ? 0.78 : burnedCell ? 0.55 : 0.45;
      L.polygon(hexCorners(geo, cell.q, cell.r), {
        stroke: false,
        fillColor,
        fillOpacity,
        interactive: false,
      }).addTo(group);
      if (onFireCell) {
        const center = hexToPixel(cell.q, cell.r, 1);
        const { lat, lng } = pixelToLatLng(geo, center.x, center.y);
        L.marker([lat, lng], { icon: FLAME_ICON, interactive: false }).addTo(group);
      }
    }
    group.addTo(map);
    return () => { group.remove(); };
  }, [engineState, mapReady]);

  // ── Effet : animation d'explosion quand le feu atteint un tank de carburant ──
  // Purement visuel — ne modifie ni l'état moteur ni la propagation du feu.
  // L'explosion se joue au tick où la cellule DEVIENT visiblement en feu, c.-à-d.
  // fireTick + 1 : le moteur enregistre fireTick au tick courant du step, mais la
  // cellule n'apparaît ON_FIRE que dans l'état du tick suivant (voir simEngine.ts).
  // fireTick est porté par l'état de chaque tick, donc l'animation se rejoue
  // fidèlement en avance/recul/saut (replay) sans aucun état mutable côté UI.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !engineState) return;
    const cellById = new Map(engineState.cells.map((c) => [c.id, c]));
    for (const tank of tanksRef.current) {
      const cell = cellById.get(tank.cellId);
      if (!cell || cell.fireTick === null || cell.fireTick + 1 !== engineState.tick) continue;
      // L'emoji est enveloppé dans un <span> animé : Leaflet positionne l'élément
      // marqueur externe (.sim-explosion-icon) via un transform translate3d — si on
      // animait ce même élément, notre transform:scale écraserait ce positionnement
      // et le 💥 sauterait dans le coin de la carte. On anime donc l'enfant.
      const icon = L.divIcon({
        className: 'sim-explosion-icon',
        html: '<span class="sim-explosion-emoji">💥</span>',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });
      const marker = L.marker([tank.lat, tank.lng], { icon, interactive: false }).addTo(map);
      setTimeout(() => marker.remove(), 1900);
    }
  }, [engineState]);

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
        {!hideHud && (
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
        )}

        {/* ── Terrain loading indicator ── */}
        {!hideHud && terrainLoading && (
          <div className="sim-terrain-loading">
            <span className="sim-terrain-loading__dot" />
            Chargement du terrain…
          </div>
        )}

        {/* ── Top-right: Map controls (toujours visibles, sauf pendant une capture) ── */}
        {!capturing && (
          <div className="sim-map-controls">
            <button className="sim-map-btn" onClick={() => mapRef.current?.zoomIn()} title="Zoom avant">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <button className="sim-map-btn" onClick={() => mapRef.current?.zoomOut()} title="Zoom arrière">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <button
              className="sim-map-btn"
              onClick={() => setLayer((l) => (l === 'plan' ? 'satellite' : 'plan'))}
              title={layer === 'satellite' ? 'Revenir au fond de carte plan' : 'Passer en vue satellite'}
            >
              {layer === 'satellite' ? (
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
            </button>
            <button className="sim-map-btn" onClick={handleFitZone} title="Recentrer sur la zone">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            <button
              className="sim-map-btn"
              onClick={() => setPanelsHidden((v) => !v)}
              title={panelsHidden ? 'Afficher les panneaux' : 'Masquer les panneaux'}
            >
              {panelsHidden ? (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.3 20.3 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a20.3 20.3 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
            <button className="sim-map-btn" onClick={handleDownload} title="Télécharger la carte">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
          </div>
        )}

        {/* ── Bottom ── */}
        {!hideHud && (
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
        )}

      </div>
    </div>
  );
}
