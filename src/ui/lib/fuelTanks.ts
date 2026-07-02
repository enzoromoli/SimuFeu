// Récupération des tanks de carburant (OSM man_made=storage_tank + contenu hydrocarbure)
// dans une zone, pour déclencher une animation d'explosion en simulation quand le feu les
// atteint. Effet purement visuel — voir docs/decisions.md.
import { Bounds } from '../../domain/types';

export interface FuelTank { lat: number; lng: number }

// Contenus explicitement NON combustibles : une cuve marquée ainsi n'explose pas.
// En pratique, sur les sites industriels (raffineries…), la plupart des cuves
// `man_made=storage_tank` n'ont AUCUN tag `content`. Les exiger explicitement comme
// carburant rejetterait presque tout — on inverse donc la logique : une cuve est
// considérée comme réservoir d'hydrocarbures par défaut, SAUF contenu non combustible.
const NON_FUEL_CONTENTS = new Set([
  'water', 'rainwater', 'wastewater', 'waste_water', 'sewage', 'waste',
  'slurry', 'silage', 'manure', 'milk', 'wine', 'beer', 'grain', 'flour',
  'cement', 'sand', 'salt', 'sugar', 'soda', 'soude', 'soude_50%',
  'caustic_soda', 'nitrogen', 'oxygen', 'air', 'co2', 'steam',
]);

function isFuelTank(tags: Record<string, string>): boolean {
  if (tags.man_made !== 'storage_tank') return false;
  const content = (tags.content ?? tags.substance ?? tags.fuel ?? '').toLowerCase();
  return !NON_FUEL_CONTENTS.has(content);
}

interface OverpassCenter { lat: number; lon: number }
interface OverpassElement {
  lat?: number
  lon?: number
  center?: OverpassCenter
  tags?: Record<string, string>
}
interface OverpassResponse { elements: OverpassElement[] }

// Miroirs Overpass publics, essayés dans l'ordre : le principal (overpass-api.de) est
// parfois surchargé (504) ; kumi.systems sert de repli plutôt que d'abandonner tout de suite.
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

async function queryOverpass(query: string): Promise<OverpassResponse | null> {
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) {
        console.warn(`[fuelTanks] ${url} a répondu ${res.status}.`);
        continue;
      }
      return await res.json();
    } catch (err) {
      console.warn(`[fuelTanks] Échec de la requête vers ${url}.`, err);
    }
  }
  return null;
}

// Effet purement cosmétique : toute erreur (réseau, parsing…) dégrade silencieusement
// vers "aucun tank détecté" plutôt que de faire échouer le chargement de la simulation.
export async function fetchFuelTanks(bounds: Bounds): Promise<FuelTank[]> {
  const { north, south, east, west } = bounds;
  const bbox = `${south},${west},${north},${east}`;
  const query =
    `[out:json][timeout:25];` +
    `(node["man_made"="storage_tank"](${bbox});` +
    `way["man_made"="storage_tank"](${bbox}););` +
    `out center tags;`;

  const data = await queryOverpass(query);
  if (!data) {
    console.warn('[fuelTanks] Tous les miroirs Overpass ont échoué — aucun tank détecté pour cette zone.');
    return [];
  }

  const tanks: FuelTank[] = [];
  for (const el of data.elements ?? []) {
    if (!el.tags || !isFuelTank(el.tags)) continue;
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat != null && lng != null) tanks.push({ lat, lng });
  }
  return tanks;
}
