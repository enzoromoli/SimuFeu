// Construction du raster terrain (OSM → image pixelisée) et échantillonnage vers les
// TerrainType du moteur. Extrait de SimulationView pour être réutilisable et testable.
//
// Cohérence : le terrain AFFICHÉ (image) et le terrain SIMULÉ (grille moteur) proviennent
// du MÊME raster — on échantillonne la couleur du pixel au centroïde de chaque cellule.
import { TerrainType } from '../../../engine/types';
import { TerrainPatch } from '../../../engine/protocol';
import { makeGrid } from '../../../engine/hexUtils';
import { cellToLatLng, GridGeo } from '../../domain/geoGrid';
import { Bounds } from '../../domain/types';

// Palette terrain (index → couleur d'affichage) ALIGNÉE par index sur PALETTE_TERRAIN.
export const TERRAIN_PALETTE_HEX: string[] = [
  '#e8e4d8',                                                             // 0  fond non classé
  '#a09080', '#b8b0a0', '#989080', '#d4c090', '#cce0f0', '#604040', '#9a8870', '#b0a888', // minéral
  '#c8a840', '#b8b030', '#b0a028', '#a8c868', '#c0b850', '#6ab8d0', '#88c8d8',            // agriculture
  '#88c040', '#5a9870', '#9a9860', '#a8c090', '#78b038', '#68a828', '#70a030',            // prairies / vert
  '#90cc50', '#48a838', '#80a840', '#c0a060',
  '#508820', '#8a8030', '#a8b880',                                                        // garrigue / lande
  '#245218',                                                                              // forêt
  '#3d6bbf', '#4878c0', '#5888c8',                                                         // eau
  '#c0bcd0', '#b0aac0', '#9898a8', '#c8c0a0', '#d8d0b8', '#808090', '#b0b8a8',            // bâti
  '#c0c0c8', '#d8d0a0', '#e0d0d0',
  '#7a7858', '#6a7858', '#c0c8c0', '#a8b0a8',                                             // militaire / aéro
];

const W = TerrainType.WATER, R = TerrainType.ROCK, WL = TerrainType.WETLAND;
const G = TerrainType.GRASSLAND, F = TerrainType.FARMLAND, SC = TerrainType.SCRUB;
const FO = TerrainType.FOREST, RES = TerrainType.RESIDENTIAL, IND = TerrainType.INDUSTRIAL;

// TerrainType par index de palette (ROCK/WATER = ininflammables ; fond → GRASSLAND).
export const PALETTE_TERRAIN: TerrainType[] = [
  G,                          // fond non classé → terrain inflammable par défaut
  R, R, R, R, R, R, R, R,     // minéral (roche, sable, glacier, mud, quarry…) → ROCK
  F, F, F, F, F, W, W,        // agriculture → FARMLAND ; aquaculture/salt_pond → WATER
  G, WL, G, G, G, G, G,       // prairie ; zone humide → WETLAND
  G, G, G, G,
  SC, SC, G,                  // garrigue / lande → SCRUB ; greenfield → GRASSLAND
  FO,                         // forêt → FOREST
  W, W, W,                    // eau
  RES, RES, IND, RES, RES, IND, RES, // bâti ; industriel/railway → INDUSTRIAL
  IND, RES, RES,
  IND, IND, IND, IND,         // militaire / aérodrome → INDUSTRIAL
];

const PALETTE_RGB: [number, number, number][] = TERRAIN_PALETTE_HEX.map((h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
]);

/** Index de palette le plus proche d'une couleur RGB. */
function nearestPaletteIndex(r: number, g: number, b: number): number {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < PALETTE_RGB.length; i++) {
    const c = PALETTE_RGB[i];
    if (!c) continue;
    const d = (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/** Couleur RGB → TerrainType (via la couleur de palette la plus proche). */
export function colorToTerrain(r: number, g: number, b: number): TerrainType {
  return PALETTE_TERRAIN[nearestPaletteIndex(r, g, b)] ?? TerrainType.GRASSLAND;
}

interface TerrainStyle { fill: string; z: number; isLine?: boolean; lw?: number }

// OSM tags → couleur d'affichage + z-order (background dessiné en premier).
export function terrainStyle(tags: Record<string, string>): TerrainStyle | null {
  const lu = tags.landuse, nat = tags.natural, ww = tags.waterway;
  const lei = tags.leisure, ame = tags.amenity, mil = tags.military, aer = tags.aeroway;

  if (nat === 'bare_rock' || nat === 'rock' || nat === 'stone') return { fill: '#a09080', z: 1 };
  if (nat === 'scree' || nat === 'shingle') return { fill: '#b8b0a0', z: 1 };
  if (nat === 'cliff') return { fill: '#989080', z: 1 };
  if (nat === 'sand' || nat === 'beach' || nat === 'dune') return { fill: '#d4c090', z: 1 };
  if (nat === 'glacier' || nat === 'snowfield') return { fill: '#cce0f0', z: 1 };
  if (nat === 'volcano') return { fill: '#604040', z: 1 };
  if (nat === 'mud') return { fill: '#9a8870', z: 1 };
  if (lu === 'quarry' || lu === 'landfill') return { fill: '#b0a888', z: 1 };

  if (lu === 'farmland' || lu === 'farmyard') return { fill: '#c8a840', z: 2 };
  if (lu === 'orchard') return { fill: '#b8b030', z: 2 };
  if (lu === 'vineyard') return { fill: '#b0a028', z: 2 };
  if (lu === 'plant_nursery' || lu === 'greenhouse_horticulture') return { fill: '#a8c868', z: 2 };
  if (lu === 'allotments') return { fill: '#c0b850', z: 2 };
  if (lu === 'aquaculture') return { fill: '#6ab8d0', z: 2 };
  if (lu === 'salt_pond') return { fill: '#88c8d8', z: 2 };

  if (nat === 'grassland' || lu === 'grass' || lu === 'meadow') return { fill: '#88c040', z: 3 };
  if (nat === 'wetland' || nat === 'marsh' || nat === 'swamp') return { fill: '#5a9870', z: 3 };
  if (nat === 'fell' || nat === 'tundra') return { fill: '#9a9860', z: 3 };
  if (lu === 'cemetery' || ame === 'grave_yard') return { fill: '#a8c090', z: 3 };
  if (lei === 'park' || lei === 'common') return { fill: '#78b038', z: 3 };
  if (lei === 'garden') return { fill: '#68a828', z: 3 };
  if (lei === 'nature_reserve') return { fill: '#70a030', z: 3 };
  if (lei === 'golf_course') return { fill: '#90cc50', z: 3 };
  if (lei === 'pitch') return { fill: '#48a838', z: 3 };
  if (lei === 'dog_park' || lei === 'horse_riding') return { fill: '#80a840', z: 3 };
  if (lei === 'track') return { fill: '#c0a060', z: 3 };

  if (nat === 'scrub') return { fill: '#508820', z: 4 };
  if (nat === 'heath' || nat === 'moor') return { fill: '#8a8030', z: 4 };
  if (lu === 'greenfield' || lu === 'brownfield') return { fill: '#a8b880', z: 4 };

  if (nat === 'wood' || lu === 'forest') return { fill: '#245218', z: 5 };

  if (nat === 'water' || nat === 'lake' || nat === 'bay') return { fill: '#3d6bbf', z: 6 };
  if (lu === 'reservoir' || lu === 'basin') return { fill: '#4878c0', z: 6 };
  if (ww === 'river' || ww === 'canal') return { fill: '#3d6bbf', z: 6, isLine: true, lw: 4 };
  if (ww === 'stream' || ww === 'drain') return { fill: '#4878c0', z: 6, isLine: true, lw: 2 };
  if (ww === 'ditch' || ww === 'tidal_channel') return { fill: '#5888c8', z: 6, isLine: true, lw: 1.5 };
  if (ww) return { fill: '#4878c0', z: 6, isLine: true, lw: 2 };

  if (lu === 'residential') return { fill: '#c0bcd0', z: 7 };
  if (lu === 'commercial' || lu === 'retail') return { fill: '#b0aac0', z: 7 };
  if (lu === 'industrial') return { fill: '#9898a8', z: 7 };
  if (lu === 'construction') return { fill: '#c8c0a0', z: 7 };
  if (lu === 'religious') return { fill: '#d8d0b8', z: 7 };
  if (lu === 'railway') return { fill: '#808090', z: 7 };
  if (lei === 'sports_centre' || lei === 'stadium') return { fill: '#b0b8a8', z: 7 };
  if (ame === 'parking') return { fill: '#c0c0c8', z: 7 };
  if (ame === 'school' || ame === 'university' || ame === 'college') return { fill: '#d8d0a0', z: 7 };
  if (ame === 'hospital') return { fill: '#e0d0d0', z: 7 };

  if (mil === 'danger_area' || mil === 'range' || mil === 'training_area') return { fill: '#7a7858', z: 8 };
  if (lu === 'military' || mil) return { fill: '#6a7858', z: 8 };
  if (aer === 'aerodrome' || aer === 'helipad') return { fill: '#c0c8c0', z: 8 };
  if (aer === 'runway' || aer === 'taxiway' || aer === 'apron') return { fill: '#a8b0a8', z: 8 };

  return null;
}

// ── Types Overpass (sous-ensemble utilisé) ───────────────────────────────
interface OsmNode { type: 'node'; id: number; lat: number; lon: number; tags?: Record<string, string> }
interface OsmWay { type: 'way'; id: number; nodes: number[]; tags?: Record<string, string> }
interface OsmRelationMember { type: string; ref: number; role: string }
interface OsmRelation { type: 'relation'; id: number; members: OsmRelationMember[]; tags?: Record<string, string> }
type OsmElement = OsmNode | OsmWay | OsmRelation
interface OverpassResponse { elements: OsmElement[] }

export interface TerrainRaster {
  url: string
  width: number
  height: number
  data: Uint8ClampedArray
  bounds: Bounds
}

const GRID = 1024;

// Construit le raster terrain. Retourne l'URL data (affichage) ET les pixels quantifiés
// + la bbox (échantillonnage). Nécessite un canvas (navigateur).
export async function buildTerrainRaster(zone: { bounds: Bounds }): Promise<TerrainRaster> {
  const { north, south, east, west } = zone.bounds;
  const bbox = `${south},${west},${north},${east}`;
  const query =
    `[out:json][timeout:90];` +
    `(` +
    `way["landuse"](${bbox});way["natural"](${bbox});way["waterway"](${bbox});` +
    `way["leisure"](${bbox});` +
    `way["amenity"~"grave_yard|cemetery|parking|school|university|college|hospital"](${bbox});` +
    `way["military"](${bbox});way["aeroway"](${bbox});` +
    `relation["landuse"](${bbox});relation["natural"](${bbox});relation["waterway"](${bbox});` +
    `relation["leisure"](${bbox});relation["military"](${bbox});relation["aeroway"](${bbox});` +
    `);(._;>>;);out body qt;`;

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const data: OverpassResponse = await res.json();

  const nodeMap: Record<number, OsmNode> = {};
  const wayMap: Record<number, OsmWay> = {};
  for (const el of data.elements) {
    if (el.type === 'node') nodeMap[el.id] = el;
    if (el.type === 'way') wayMap[el.id] = el;
  }

  const canvas = document.createElement('canvas');
  canvas.width = GRID;
  canvas.height = GRID;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponible');
  ctx.fillStyle = '#e8e4d8';
  ctx.fillRect(0, 0, GRID, GRID);

  const toXY = (lat: number, lon: number): [number, number] => [
    ((lon - west) / (east - west)) * GRID,
    ((north - lat) / (north - south)) * GRID,
  ];

  const isNode = (n: OsmNode | undefined): n is OsmNode => Boolean(n);
  const features: { pts: OsmNode[]; style: TerrainStyle }[] = [];

  for (const el of data.elements) {
    if (el.type !== 'way' || !el.tags || !el.nodes?.length) continue;
    const style = terrainStyle(el.tags);
    if (!style) continue;
    const pts = el.nodes.map((id) => nodeMap[id]).filter(isNode);
    if (pts.length < 2) continue;
    features.push({ pts, style });
  }
  for (const el of data.elements) {
    if (el.type !== 'relation' || !el.tags || !el.members) continue;
    const style = terrainStyle(el.tags);
    if (!style) continue;
    for (const member of el.members) {
      if (member.type !== 'way' || member.role !== 'outer') continue;
      const way = wayMap[member.ref];
      if (!way || !way.nodes?.length) continue;
      const pts = way.nodes.map((id) => nodeMap[id]).filter(isNode);
      if (pts.length < 2) continue;
      features.push({ pts, style: { ...style } });
    }
  }

  features.sort((a, b) => a.style.z - b.style.z);
  for (const { pts, style } of features) {
    const first = pts[0];
    if (!first) continue;
    ctx.beginPath();
    const [x0, y0] = toXY(first.lat, first.lon);
    ctx.moveTo(x0, y0);
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      if (!p) continue;
      const [x, y] = toXY(p.lat, p.lon);
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

  // Quantification vers la palette (bords nets + couleurs exactes pour l'échantillonnage).
  const imgData = ctx.getImageData(0, 0, GRID, GRID);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const idx = nearestPaletteIndex(d[i] ?? 0, d[i + 1] ?? 0, d[i + 2] ?? 0);
    const c = PALETTE_RGB[idx];
    if (!c) continue;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  return {
    url: canvas.toDataURL('image/png'),
    width: GRID,
    height: GRID,
    data: imgData.data,
    bounds: zone.bounds,
  };
}

// Échantillonne le raster au centroïde de chaque cellule de la grille → TerrainPatch[].
export function sampleGridTerrain(raster: TerrainRaster, geo: GridGeo): TerrainPatch[] {
  const { north, south, east, west } = raster.bounds;
  const { width, height, data } = raster;
  const patches: TerrainPatch[] = [];
  for (const cell of makeGrid(geo.radius).values()) {
    const { lat, lng } = cellToLatLng(geo, cell.q, cell.r);
    let px = Math.floor(((lng - west) / (east - west)) * width);
    let py = Math.floor(((north - lat) / (north - south)) * height);
    px = Math.max(0, Math.min(width - 1, px));
    py = Math.max(0, Math.min(height - 1, py));
    const i = (py * width + px) * 4;
    patches.push({ id: cell.id, terrain: colorToTerrain(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0) });
  }
  return patches;
}
