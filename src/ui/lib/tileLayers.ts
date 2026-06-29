import type L from 'leaflet';
import type { MapLayer } from '../types/sim';

// Fonds de carte partagés entre l'écran de paramétrage (MapPanel) et la simulation
// (SimulationView), pour afficher la même carte dans les deux écrans.
export const TILE_LAYERS: Record<MapLayer, { url: string; options: L.TileLayerOptions }> = {
  plan: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 },
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: { attribution: 'Tiles &copy; Esri', maxZoom: 19 },
  },
};
