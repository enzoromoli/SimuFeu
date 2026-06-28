# Spec — Branchement UI ↔ moteur (vue de simulation réelle)

## Objectif

Remplacer le playback **mock** de la vue de simulation par un pilotage du **moteur réel** :
géoréférencer la grille hexagonale sur la zone dessinée, remplir le terrain de chaque
cellule depuis les données OSM affichées, propager le feu via le moteur, et naviguer dans
l'historique des ticks. Pour : l'équipe SimuFeu (rend la simulation effective et cohérente).

## Entrées / sorties

- **Entrées** : `zone = { bounds:{north,south,east,west}, areaKm2 }` + `params` (vent, etc.)
  produits par l'écran de config ; le raster OSM déjà calculé par l'UI ; le protocole worker.
- **Sorties** : la vue de simu affiche **2 couches** (raster terrain en fond + feu en
  surcouche) pilotées par les messages `state` du moteur ; navigation avant/arrière/saut.

## Règles

- **Géoréférencement** (`src/domain/geoGrid.ts`, pur) : `boundsToGrid(bounds, radius)` →
  paramètres de transform ; `cellToLatLng(geo, q, r)` et `latLngToCell(geo, lat, lng)`
  inverses l'une de l'autre. Réutilise `hexToPixel`/`pixelToHex` de `engine/hexUtils.ts`.
  Mapping linéaire (courbure terrestre négligée — zones petites). Le moteur reste agnostique.
- **Cohérence terrain** : le terrain qui pilote le feu provient du **même raster** que celui
  affiché. On échantillonne la couleur du pixel au centroïde de chaque cellule, puis on la
  mappe vers un `TerrainType` (table couleur-palette → type). Pixel de fond non classé →
  `GRASSLAND` (terrain inflammable par défaut).
- **Protocole** : types partagés dans `engine/protocol.ts` (importés par le worker et l'UI).
  Ajout d'un message `loadTerrain { cells: {id, terrain}[] }` (remplissage en masse au
  tick 0) pour éviter des centaines de messages `paint`.
- **Flux** : à l'arrivée sur la vue de simu → `init { radius, seed }` → échantillonnage →
  `loadTerrain` → l'utilisateur pose un foyer (`ignite`) → lecture = `navigate forward`
  cadencé par la vitesse ; barre = `navigate backward`/`jump`. Arrêt quand `isComplete()`
  (le moteur ne dépasse plus `tickMax`).
- **Rendu** : couche feu = polygones Leaflet hexagonaux pour les cellules `ON_FIRE` /
  `BURNED` (couleurs : foyer actif / zone brûlée). Le terrain reste le raster. La grille hex
  colorée comme unique représentation est hors scope (polish optionnel).
- **Outils** : `feu` → `ignite` la cellule cliquée (`latLngToCell`) ; `vegetation` → `paint`
  un `TerrainType` ; `effacer` → reset local. Pas de `Math.random` côté logique.

## Critères d'acceptation

- [ ] `boundsToGrid` + `cellToLatLng`/`latLngToCell` : round-trip stable (tests purs).
- [ ] La couleur d'un pixel de palette se mappe au bon `TerrainType` (test pur).
- [ ] Message `loadTerrain` : remplit les terrains attendus au tick 0 (test node worker).
- [ ] Scénario `init`→`loadTerrain`→`ignite`→`navigate forward*` : le feu se propage puis
      s'arrête (`isComplete`) ; reculer ne recalcule pas (test node).
- [ ] Vue de simu (smoke manuel) : zone → foyer → propagation tick par tick, navigation
      avant/arrière, terrain affiché = terrain simulé.

## Hors scope

- Modèle de vent directionnel dans la propagation (TODO déjà marqué dans `simEngine.ts`).
- Grille hexagonale colorée comme unique représentation du terrain.
- Convergence du raster UI vers la couche domaine `osmClassify` (polish ultérieur).
- Conversion TypeScript de l'UI (lot 3).

## Décisions liées (voir `docs/decisions.md`)

- 2 couches (raster + feu), grille remplie par échantillonnage du raster.
- Géoréférencement dans `src/domain` ; moteur agnostique.
- Message `loadTerrain` pour le remplissage en masse.
