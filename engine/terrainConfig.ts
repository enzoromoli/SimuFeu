import { TerrainType } from './types'

export interface TerrainConfig {
  // probabilité de base qu'une cellule prenne feu (0 = ignifuge, 1 = s'enflamme toujours)
  flammability: number
  // nombre de ticks pendant lesquels la cellule brûle avant de devenir cendres
  burnDuration: number
  // bonus ajouté à la probabilité de propagation vers les voisins
  spreadBonus:  number
  // couleur d'affichage sur la carte, calquée sur le style OSM-carto
  color:        string
  // nom affiché dans l'interface
  label:        string
  // tags OSM source utilisés pour mapper ce type lors de l'import de carte
  osmTags:      string[]
}

export const TERRAIN_CONFIG: Record<TerrainType, TerrainConfig> = {
  [TerrainType.WATER]:       { flammability: 0,    burnDuration: 0, spreadBonus: 0,    color: '#aad3df', label: 'Eau',           osmTags: ['natural=water', 'waterway=*', 'landuse=reservoir']            },
  [TerrainType.ROCK]:        { flammability: 0,    burnDuration: 0, spreadBonus: 0,    color: '#c9c0b1', label: 'Roche',         osmTags: ['natural=bare_rock', 'natural=scree', 'natural=cliff']         },
  [TerrainType.WETLAND]:     { flammability: 0.08, burnDuration: 2, spreadBonus: 0.02, color: '#7ba3a8', label: 'Zone humide',   osmTags: ['natural=wetland']                                             },
  [TerrainType.GRASSLAND]:   { flammability: 0.45, burnDuration: 2, spreadBonus: 0.18, color: '#cdebb0', label: 'Prairie',       osmTags: ['natural=grassland', 'landuse=meadow', 'landuse=grass']        },
  [TerrainType.FARMLAND]:    { flammability: 0.30, burnDuration: 3, spreadBonus: 0.08, color: '#eef0d5', label: 'Terres agri.',  osmTags: ['landuse=farmland', 'landuse=orchard', 'landuse=vineyard']     },
  [TerrainType.SCRUB]:       { flammability: 0.80, burnDuration: 7, spreadBonus: 0.28, color: '#c8d7ab', label: 'Maquis',        osmTags: ['natural=scrub', 'natural=heath']                              },
  [TerrainType.FOREST]:      { flammability: 0.72, burnDuration: 8, spreadBonus: 0.20, color: '#add19e', label: 'Forêt',         osmTags: ['landuse=forest', 'natural=wood']                              },
  [TerrainType.RESIDENTIAL]: { flammability: 0.45, burnDuration: 6, spreadBonus: 0.10, color: '#dfc0c0', label: 'Résidentiel',   osmTags: ['landuse=residential']                                         },
  [TerrainType.INDUSTRIAL]:  { flammability: 0.55, burnDuration: 7, spreadBonus: 0.12, color: '#ebdbe8', label: 'Industriel',    osmTags: ['landuse=industrial', 'landuse=commercial']                    },
}

// poids de la pression globale d'incendie sur la probabilité d'ignition
export const PRESSURE_COEFF = 0.08
// poids des voisins en feu dans le calcul de propagation
export const NEIGHBOR_FIRE_WEIGHT = 0.28
