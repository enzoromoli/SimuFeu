import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './SimulationView.css';

const STEP_MIN = 3;
const TOTAL_STEPS = 80;
const SPEEDS = [1, 2, 5];

const TOOLS = [
  {
    id: 'feu',
    label: 'Feu',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
      </svg>
    ),
  },
  {
    id: 'vegetation',
    label: 'Végétation',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
        <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
      </svg>
    ),
  },
  {
    id: 'dessiner',
    label: 'Dessiner',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
      </svg>
    ),
  },
  {
    id: 'vent',
    label: 'Vent',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/>
        <path d="M9.6 4.6A2 2 0 1 1 11 8H2"/>
        <path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>
      </svg>
    ),
  },
  {
    id: 'donnees',
    label: 'Données',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    id: 'effacer',
    label: 'Effacer',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
      </svg>
    ),
  },
];

const LEGEND_ITEMS = [
  { color: '#f5921e', label: 'Foyer actif' },
  { color: '#c06228', label: 'Zone brûlée' },
  { color: '#3d6bbf', label: 'Eau' },
  { color: '#245218', label: 'Forêt' },
  { color: '#508820', label: 'Garrigue / lande' },
  { color: '#88c040', label: 'Prairie / herbe' },
  { color: '#c8a840', label: 'Cultures' },
  { color: '#d4c090', label: 'Sable / plage' },
  { color: '#a09080', label: 'Roche / falaise' },
  { color: '#cce0f0', label: 'Glacier / neige' },
  { color: '#c0bcd0', label: 'Zone résidentielle' },
  { color: '#9898a8', label: 'Zone industrielle' },
  { color: '#6a7858', label: 'Zone militaire' },
  { color: '#c0c8c0', label: 'Aérodrome' },
];

// ── Overpass API → pixel grid ─────────────────────────────────────────────

// Comprehensive OSM tag → terrain colour + z-order
// Z order: lower drawn first (background), higher on top
function terrainStyle(tags) {
  const lu  = tags.landuse;
  const nat = tags.natural;
  const ww  = tags.waterway;
  const lei = tags.leisure;
  const ame = tags.amenity;
  const mil = tags.military;
  const aer = tags.aeroway;

  // ── Z 1 : sol nu / minéral ─────────────────────────────────────────────
  if (nat === 'bare_rock' || nat === 'rock' || nat === 'stone')
    return { fill: '#a09080', z: 1 };
  if (nat === 'scree' || nat === 'shingle')
    return { fill: '#b8b0a0', z: 1 };
  if (nat === 'cliff')
    return { fill: '#989080', z: 1 };
  if (nat === 'sand' || nat === 'beach' || nat === 'dune')
    return { fill: '#d4c090', z: 1 };
  if (nat === 'glacier' || nat === 'snowfield')
    return { fill: '#cce0f0', z: 1 };
  if (nat === 'volcano')
    return { fill: '#604040', z: 1 };
  if (nat === 'mud')
    return { fill: '#9a8870', z: 1 };
  if (lu === 'quarry' || lu === 'landfill')
    return { fill: '#b0a888', z: 1 };

  // ── Z 2 : agriculture ──────────────────────────────────────────────────
  if (lu === 'farmland' || lu === 'farmyard')
    return { fill: '#c8a840', z: 2 };
  if (lu === 'orchard')
    return { fill: '#b8b030', z: 2 };
  if (lu === 'vineyard')
    return { fill: '#b0a028', z: 2 };
  if (lu === 'plant_nursery' || lu === 'greenhouse_horticulture')
    return { fill: '#a8c868', z: 2 };
  if (lu === 'allotments')
    return { fill: '#c0b850', z: 2 };
  if (lu === 'aquaculture')
    return { fill: '#6ab8d0', z: 2 };
  if (lu === 'salt_pond')
    return { fill: '#88c8d8', z: 2 };

  // ── Z 3 : prairies / zones humides / espaces verts ────────────────────
  if (nat === 'grassland' || lu === 'grass' || lu === 'meadow')
    return { fill: '#88c040', z: 3 };
  if (nat === 'wetland' || nat === 'marsh' || nat === 'swamp')
    return { fill: '#5a9870', z: 3 };
  if (nat === 'fell' || nat === 'tundra')
    return { fill: '#9a9860', z: 3 };
  if (lu === 'cemetery' || ame === 'grave_yard')
    return { fill: '#a8c090', z: 3 };
  if (lei === 'park' || lei === 'common')
    return { fill: '#78b038', z: 3 };
  if (lei === 'garden')
    return { fill: '#68a828', z: 3 };
  if (lei === 'nature_reserve')
    return { fill: '#70a030', z: 3 };
  if (lei === 'golf_course')
    return { fill: '#90cc50', z: 3 };
  if (lei === 'pitch')
    return { fill: '#48a838', z: 3 };
  if (lei === 'dog_park' || lei === 'horse_riding')
    return { fill: '#80a840', z: 3 };
  if (lei === 'track')
    return { fill: '#c0a060', z: 3 };

  // ── Z 4 : garigue / lande ──────────────────────────────────────────────
  if (nat === 'scrub')
    return { fill: '#508820', z: 4 };
  if (nat === 'heath' || nat === 'moor')
    return { fill: '#8a8030', z: 4 };
  if (lu === 'greenfield' || lu === 'brownfield')
    return { fill: '#a8b880', z: 4 };

  // ── Z 5 : forêt ────────────────────────────────────────────────────────
  if (nat === 'wood' || lu === 'forest')
    return { fill: '#245218', z: 5 };

  // ── Z 6 : eau ──────────────────────────────────────────────────────────
  if (nat === 'water' || nat === 'lake' || nat === 'bay')
    return { fill: '#3d6bbf', z: 6 };
  if (lu === 'reservoir' || lu === 'basin')
    return { fill: '#4878c0', z: 6 };
  if (ww === 'river' || ww === 'canal')
    return { fill: '#3d6bbf', z: 6, isLine: true, lw: 4 };
  if (ww === 'stream' || ww === 'drain')
    return { fill: '#4878c0', z: 6, isLine: true, lw: 2 };
  if (ww === 'ditch' || ww === 'tidal_channel')
    return { fill: '#5888c8', z: 6, isLine: true, lw: 1.5 };
  if (ww) // other waterways
    return { fill: '#4878c0', z: 6, isLine: true, lw: 2 };

  // ── Z 7 : zone bâtie / infrastructure ─────────────────────────────────
  if (lu === 'residential')
    return { fill: '#c0bcd0', z: 7 };
  if (lu === 'commercial' || lu === 'retail')
    return { fill: '#b0aac0', z: 7 };
  if (lu === 'industrial')
    return { fill: '#9898a8', z: 7 };
  if (lu === 'construction')
    return { fill: '#c8c0a0', z: 7 };
  if (lu === 'religious')
    return { fill: '#d8d0b8', z: 7 };
  if (lu === 'railway')
    return { fill: '#808090', z: 7 };
  if (lei === 'sports_centre' || lei === 'stadium')
    return { fill: '#b0b8a8', z: 7 };
  if (ame === 'parking')
    return { fill: '#c0c0c8', z: 7 };
  if (ame === 'school' || ame === 'university' || ame === 'college')
    return { fill: '#d8d0a0', z: 7 };
  if (ame === 'hospital')
    return { fill: '#e0d0d0', z: 7 };

  // ── Z 8 : militaire / aérodrome ───────────────────────────────────────
  if (mil === 'danger_area' || mil === 'range' || mil === 'training_area')
    return { fill: '#7a7858', z: 8 };
  if (lu === 'military' || mil)
    return { fill: '#6a7858', z: 8 };
  if (aer === 'aerodrome' || aer === 'helipad')
    return { fill: '#c0c8c0', z: 8 };
  if (aer === 'runway' || aer === 'taxiway' || aer === 'apron')
    return { fill: '#a8b0a8', z: 8 };

  return null;
}

// Palette complète de toutes les couleurs terrain — utilisée pour la quantification pixel
const TERRAIN_PALETTE_HEX = [
  '#e8e4d8',
  '#a09080','#b8b0a0','#989080','#d4c090','#cce0f0','#604040','#9a8870','#b0a888',
  '#c8a840','#b8b030','#b0a028','#a8c868','#c0b850','#6ab8d0','#88c8d8',
  '#88c040','#5a9870','#9a9860','#a8c090','#78b038','#68a828','#70a030',
  '#90cc50','#48a838','#80a840','#c0a060',
  '#508820','#8a8030','#a8b880',
  '#245218',
  '#3d6bbf','#4878c0','#5888c8',
  '#c0bcd0','#b0aac0','#9898a8','#c8c0a0','#d8d0b8','#808090','#b0b8a8',
  '#c0c0c8','#d8d0a0','#e0d0d0',
  '#7a7858','#6a7858','#c0c8c0','#a8b0a8',
];

const TERRAIN_PALETTE_RGB = TERRAIN_PALETTE_HEX.map(h => [
  parseInt(h.slice(1,3),16),
  parseInt(h.slice(3,5),16),
  parseInt(h.slice(5,7),16),
]);

function nearestTerrainColor(r, g, b) {
  let best = TERRAIN_PALETTE_RGB[0], bestD = Infinity;
  for (const c of TERRAIN_PALETTE_RGB) {
    const d = (r-c[0])**2 + (g-c[1])**2 + (b-c[2])**2;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

async function buildPixelTerrain(zone) {
  const { north, south, east, west } = zone.bounds;
  // Résolution de la grille pixel — chaque cellule = un carré visible à l'écran
  const GRID = 1024;

  const bbox = `${south},${west},${north},${east}`;
  // Inclut les relations (multipolygones OSM) + récursion complète pour leurs noeuds
  const query =
    `[out:json][timeout:90];` +
    `(` +
    `way["landuse"](${bbox});` +
    `way["natural"](${bbox});` +
    `way["waterway"](${bbox});` +
    `way["leisure"](${bbox});` +
    `way["amenity"~"grave_yard|cemetery|parking|school|university|college|hospital"](${bbox});` +
    `way["military"](${bbox});` +
    `way["aeroway"](${bbox});` +
    `relation["landuse"](${bbox});` +
    `relation["natural"](${bbox});` +
    `relation["waterway"](${bbox});` +
    `relation["leisure"](${bbox});` +
    `relation["military"](${bbox});` +
    `relation["aeroway"](${bbox});` +
    `);` +
    `(._;>>;);` +
    `out body qt;`;

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const data = await res.json();

  // Index nodes et ways pour résoudre les membres de relations
  const nodeMap = {};
  const wayMap = {};
  for (const el of data.elements) {
    if (el.type === 'node') nodeMap[el.id] = el;
    if (el.type === 'way') wayMap[el.id] = el;
  }

  // Grille de rendu basse résolution — donne l'aspect pixel
  const canvas = document.createElement('canvas');
  canvas.width = GRID;
  canvas.height = GRID;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#e8e4d8';
  ctx.fillRect(0, 0, GRID, GRID);

  const toXY = (lat, lon) => [
    (lon - west)  / (east  - west)  * GRID,
    (north - lat) / (north - south) * GRID,
  ];

  const features = [];

  // Ways directement taggués
  for (const el of data.elements) {
    if (el.type !== 'way' || !el.tags || !el.nodes?.length) continue;
    const style = terrainStyle(el.tags);
    if (!style) continue;
    const pts = el.nodes.map(id => nodeMap[id]).filter(Boolean);
    if (pts.length < 2) continue;
    features.push({ pts, style });
  }

  // Relations multipolygones — anneaux extérieurs uniquement
  for (const el of data.elements) {
    if (el.type !== 'relation' || !el.tags || !el.members) continue;
    const style = terrainStyle(el.tags);
    if (!style) continue;
    for (const member of el.members) {
      if (member.type !== 'way' || member.role !== 'outer') continue;
      const way = wayMap[member.ref];
      if (!way?.nodes?.length) continue;
      const pts = way.nodes.map(id => nodeMap[id]).filter(Boolean);
      if (pts.length < 2) continue;
      features.push({ pts, style: { ...style } });
    }
  }

  features.sort((a, b) => a.style.z - b.style.z);

  for (const { pts, style } of features) {
    ctx.beginPath();
    const [x0, y0] = toXY(pts[0].lat, pts[0].lon);
    ctx.moveTo(x0, y0);
    for (let i = 1; i < pts.length; i++) {
      const [x, y] = toXY(pts[i].lat, pts[i].lon);
      ctx.lineTo(x, y);
    }
    if (style.isLine) {
      ctx.strokeStyle = style.fill;
      ctx.lineWidth = Math.max(1, (style.lw ?? 2) * (GRID / 512));
      ctx.stroke();
    } else {
      ctx.closePath();
      ctx.fillStyle = style.fill;
      ctx.fill();
    }
  }

  // Quantification — chaque pixel est forcé vers la couleur terrain la plus proche
  // Cela élimine l'anti-aliasing et garantit des bords nets entre pixels
  const imgData = ctx.getImageData(0, 0, GRID, GRID);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, b] = nearestTerrainColor(d[i], d[i+1], d[i+2]);
    d[i] = r; d[i+1] = g; d[i+2] = b; d[i+3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  return canvas.toDataURL('image/png');
}

// ─────────────────────────────────────────────────────────────────────────────

function formatHHMM(totalMin) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function degToCardinalFR(deg) {
  const dirs = ['Nord', 'Nord-Est', 'Est', 'Sud-Est', 'Sud', 'Sud-Ouest', 'Ouest', 'Nord-Ouest'];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

export default function SimulationView({ zone, params, onExit }) {
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const zoneBoundsRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [step, setStep] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [activeTool, setActiveTool] = useState('feu');
  const [terrainURL, setTerrainURL] = useState(null);
  const [terrainLoading, setTerrainLoading] = useState(false);

  const elapsedMin = step * STEP_MIN;
  const totalMin = (TOTAL_STEPS - 1) * STEP_MIN;
  const progress = TOTAL_STEPS > 1 ? (step / (TOTAL_STEPS - 1)) * 100 : 0;
  const cellsBurned = Math.floor(step * 8.7);
  const areaBurned = ((cellsBurned * 0.0025) * ((zone?.areaKm2 ?? 10) / 10)).toFixed(1);
  const frontSpeed = Math.max(0, Math.round(8 + step * 0.18));
  const windDir = params.windDirection ?? 252;
  const windSpeed = params.windSpeed ?? 13;
  const fuelMoisture = params.fuelMoisture ?? 12;

  const handleFitZone = () => {
    if (mapRef.current && zoneBoundsRef.current) {
      mapRef.current.fitBounds(zoneBoundsRef.current, { padding: [50, 50], animate: true });
    }
  };

  const handleDownload = async () => {
    const el = mapElRef.current;
    if (!el) return;
    const domRect = el.getBoundingClientRect();
    await window.capture?.map(
      {
        x: Math.round(domRect.x),
        y: Math.round(domRect.y),
        width: Math.round(domRect.width),
        height: Math.round(domRect.height),
      },
      params.simName || 'zone',
    );
  };

  // Effect 1 — map init (no terrain here, terrain added once ready)
  useEffect(() => {
    if (!mapElRef.current) return;

    const map = L.map(mapElRef.current, {
      attributionControl: false,
      zoomControl: false,
      maxBoundsViscosity: 1.0,
    });
    mapRef.current = map;

    if (zone) {
      const bounds = L.latLngBounds(
        [zone.bounds.south, zone.bounds.west],
        [zone.bounds.north, zone.bounds.east],
      );
      zoneBoundsRef.current = bounds;
      map.fitBounds(bounds, { padding: [50, 50] });
      map.setMaxBounds(bounds.pad(0.08));
    } else {
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
      map.setView([46.8, 2.5], 6);
    }

    return () => { map.remove(); mapRef.current = null; };
  }, [zone]);

  // Effect 2 — fetch real OSM tiles, pixelate, quantise
  useEffect(() => {
    if (!zone) return;
    let cancelled = false;
    setTerrainURL(null);
    setTerrainLoading(true);

    buildPixelTerrain(zone)
      .then(url => { if (!cancelled) { setTerrainURL(url); setTerrainLoading(false); } })
      .catch(() => { if (!cancelled) setTerrainLoading(false); });

    return () => { cancelled = true; };
  }, [zone]);

  // Effect 3 — add terrain overlay once pixel canvas is ready
  useEffect(() => {
    if (!mapRef.current || !terrainURL || !zoneBoundsRef.current) return;
    const overlay = L.imageOverlay(terrainURL, zoneBoundsRef.current, {
      opacity: 1,
      interactive: false,
      className: 'sim-terrain',
    }).addTo(mapRef.current);
    return () => overlay.remove();
  }, [terrainURL]);

  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      setStep((s) => {
        if (s >= TOTAL_STEPS - 1) { setIsPlaying(false); return s; }
        return s + 1;
      });
    }, 800 / speed);
    return () => clearInterval(id);
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
            <li>
              <span>Surface brûlée</span>
              <span className="val-accent">{areaBurned} km²</span>
            </li>
            <li>
              <span>Vitesse du front</span>
              <span className="val-accent">{frontSpeed} km/h</span>
            </li>
            <li>
              <span>Direction</span>
              <span className="val-bold">{windDir}° {degToCardinalFR(windDir)}</span>
            </li>
            <li>
              <span>Température</span>
              <span className="val-bold">{params.temperature ?? 28} °C</span>
            </li>
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
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>
            </svg>
          </button>
          <button className="sim-map-btn" onClick={() => mapRef.current?.zoomOut()} title="Zoom arrière">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          <button className="sim-map-btn" onClick={handleFitZone} title="Recentrer sur la zone">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>
              <path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
          <button className="sim-map-btn" onClick={handleDownload} title="Télécharger la carte">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
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
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
              </svg>
            </button>
          </div>

          {/* Center: Bars */}
          <div className="sim-bottom-center">

            {/* Bar 1 — Playback */}
            <div className="sim-bar sim-bar--playback">
              <div className="sim-progress">
                <span className="sim-progress__cur">
                  T+ <em>{formatHHMM(elapsedMin)}</em>
                </span>
                <div className="sim-progress__track">
                  <div className="sim-progress__fill" style={{ width: `${progress}%` }} />
                  <input
                    type="range"
                    className="sim-progress__input"
                    min={0}
                    max={TOTAL_STEPS - 1}
                    value={step}
                    onChange={(e) => { setIsPlaying(false); setStep(Number(e.target.value)); }}
                  />
                </div>
                <span className="sim-progress__total">/ {formatHHMM(totalMin)}</span>
              </div>

              <div className="sim-playback">
                <button className="sim-ctl" onClick={() => { setIsPlaying(false); setStep(0); }} title="Début">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
                </button>
                <button className="sim-ctl" onClick={() => setStep(s => Math.max(0, s - 5))} title="Reculer">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6 8.5 6V6l-8.5 6z"/></svg>
                </button>
                <button className="sim-ctl sim-ctl--play" onClick={() => setIsPlaying(v => !v)} title={isPlaying ? 'Pause' : 'Lancer'}>
                  {isPlaying
                    ? <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                    : <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  }
                </button>
                <button className="sim-ctl" onClick={() => setStep(s => Math.min(TOTAL_STEPS - 1, s + 5))} title="Avancer">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
                </button>
                <button className="sim-ctl" onClick={() => { setIsPlaying(false); setStep(TOTAL_STEPS - 1); }} title="Fin">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                </button>

                <div className="sim-speeds">
                  {SPEEDS.map(s => (
                    <button key={s} className={`sim-speed${speed === s ? ' is-active' : ''}`} onClick={() => setSpeed(s)}>
                      ×{s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bar 2 — Tools */}
            <div className="sim-bar sim-bar--tools">
              {TOOLS.map(tool => (
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
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5"/>
                  <polyline points="6 10 12 4 18 10"/>
                </svg>
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
