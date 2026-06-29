# Journal de décisions

Ce fichier trace les choix techniques du projet. **Format : une ligne par décision**,
indiquant **quoi** (la décision) et **pourquoi** (la raison). On ajoute une ligne dès
qu'un choix technique est arrêté, pour garder une trace partagée par l'équipe.

Statut : `Prise` (actée, souvent déjà dans le code) ou `À trancher` (voir section dédiée).

## Décisions prises

| Date       | Décision                                                                 | Pourquoi                                                                 | Statut |
|------------|--------------------------------------------------------------------------|--------------------------------------------------------------------------|--------|
| 2026-06-26 | Génération des ticks lazy (à la demande)                                  | Meilleure réactivité au démarrage ; aligné avec la règle spec « avancer au-delà du dernier tick déclenche le calcul » | Prise  |
| 2026-06-26 | Stockage de l'historique en snapshots complets (SimState[])               | Accès O(1) à n'importe quel tick, implémentation simple ; la mémoire (~9 Mo pour 200 ticks / rayon 12) est acceptable pour une appli desktop | Prise  |
| 2026-06-26 | Structure de l'historique : Array indexé par tick                         | Les ticks sont des entiers séquentiels 0..N ; `history[t]` est l'accès naturel, troncature = `splice(t+1)` | Prise  |
| 2026-06-26 | Seed dérivée par tick : `seed_t = derive(globalSeed, t)`                  | Permet de régénérer les ticks > t après modification de la map SANS rejouer depuis 0 ; garantit la reproductibilité partielle | Prise  |
| 2026-06-26 | PRNG : mulberry32 (32 bits, pur JS)                                       | Qualité suffisante pour la sim, aucune dépendance externe, déterministe et rapide | Prise  |
| 2026-06-26 | `step(state, rng)` — RNG injecté plutôt que `Math.random()`              | Rend la fonction pure et testable sans mock ; découple le moteur du PRNG global | Prise  |
| 2026-06-15 | Electron comme conteneur de l'application de bureau                       | Livrable `.exe` multi-OS, UI web réutilisable, accès Node pour le moteur  | Prise  |
| 2026-06-15 | electron-builder, cible NSIS Windows (`build:win`)                        | Produire l'installeur `.exe` attendu comme livrable                       | Prise  |
| 2026-06-15 | Moteur de simulation isolé dans un Worker Thread (`engine/worker.js`)     | Séparer la logique de calcul de l'UI, ne pas bloquer le thread du renderer | Prise  |
| 2026-06-15 | Communication UI <-> moteur via IPC Electron + `contextBridge` (preload)  | Pont sûr entre renderer et main, qui relaie ensuite vers le worker        | Prise  |
| 2026-06-15 | `contextIsolation: true` / `nodeIntegration: false`                      | Bonne pratique de sécurité Electron : isoler le renderer de Node          | Prise  |
| 2026-06-25 | Nouveau code applicatif en **TypeScript** (feature ingestion OSM)         | L'engine est déjà en TS ; on n'écrit plus de JS neuf (migration de l'existant toujours À trancher) | Prise  |
| 2026-06-25 | Outillage TS + Vitest mis en place sur `dev` (tsconfig, vitest.config.mts) | Absents de `dev` (présents sur `simu-engine` non mergée) ; nécessaires pour la feature, sans casser Electron | Prise  |
| 2026-06-25 | Bbox passée en objet nommé `Bounds {south,west,north,east}`               | Évite les bugs d'ordre positionnel des coordonnées                        | Prise  |
| 2026-06-25 | Overpass : **une seule** requête (union de tous les tags), endpoint configurable par `OVERPASS_ENDPOINT` | Limiter la charge réseau ; pouvoir basculer sur un miroir            | Prise  |
| 2026-06-25 | Conversion bbox -> ordre Overpass (sud,ouest,nord,est) faite dans le client | Détail d'API non exposé à l'appelant                                    | Prise  |
| 2026-06-25 | **osmtogeojson** retenu pour normaliser Overpass -> GeoJSON               | Lib éprouvée vs réécriture maison ; v3 fournit ses propres types          | Prise  |
| 2026-06-25 | **Copie locale** de `TerrainType` + `osmTags` (`src/domain/types.ts`)     | `simu-engine` non mergée -> interdiction d'importer `engine/` ; **à resynchroniser au merge** | Prise  |
| 2026-06-25 | **Resync effectué** : `src/domain/types.ts` ré-exporte `TerrainType` et dérive `OSM_TAGS` depuis `engine/` (fin de la copie locale) | `simu-engine` mergée dans `dev` -> source unique de vérité ; on n'importe que des données pures (types + config), pas la logique de simulation | Prise  |
| 2026-06-25 | Feature OSM sans tag reconnu : **ignorée** par le classifieur             | Choix initial simple, **réversible** (pourra devenir un type « inconnu »)  | Prise  |
| 2026-06-25 | Cache derrière une **interface** `OsmCache` (get/set), impl. fichiers (`fs`) | `fs` pour scripts/tests Node ; impl. IndexedDB plus tard côté renderer (pas d'accès `fs`) | Prise  |
| 2026-06-25 | Script de démo exécuté via **tsx** (`npm run ingest:demo`)                | Lance le `.ts` sans étape de build                                        | Prise  |
| 2026-06-28 | UI en **React + Vite**, isolée dans la couche **`src/ui/`** (`vite root = src/ui`) | Matérialise l'archi en couches (engine/domain/app/ui) ; sépare le code renderer React des couches métier `src/domain` et `src/app` | Prise  |
| 2026-06-28 | **Port** de l'UI sur branche neuve `feat/ui-integration` depuis `dev` (pas de merge de `feat/settings-page`) | `feat/settings-page` a divergé avant le moteur (stub `engine/worker.js`, aucun fichier moteur TS) ; un merge écraserait/entrerait en conflit avec le moteur | Prise  |
| 2026-06-28 | Cohabitation outillage **Vite** (renderer) + **tsc** (engine→js) + **vitest**, harnais UI jsdom + RTL ajouté | Lancer React sans casser le build moteur ni les tests Node existants ; pouvoir tester les composants | Prise  |
| 2026-06-28 | Vue de simu branchée au moteur en **2 couches** (raster terrain en fond + feu en surcouche) | Plus rapide à brancher en réutilisant le raster OSM existant ; grille hex unifiée = polish optionnel sans gain de cohérence | Prise  |
| 2026-06-28 | Cohérence terrain : **grille moteur remplie par échantillonnage du raster OSM** (pixel du centroïde → TerrainType) | Terrain affiché = terrain simulé, sans écrire de géométrie point-dans-polygone | Prise  |
| 2026-06-28 | **Géoréférencement de la grille** (bbox → rayon/origine, hex ↔ lat/lon) = nouvelle feature dans `src/domain` | Le moteur reste agnostique géographiquement ; lève le hors-scope « grille + géoréférencement » de `osm-ingestion.md` | Prise  |
| 2026-06-28 | **`electron/` reste en JS** ; seuls `src/ui` + renderer passent en TS | Frontière Electron petite et stable ; éviter un build du process principal ; referme partiellement la migration JS→TS | Prise  |
| 2026-06-28 | Message worker **`loadTerrain { cells }`** + helper pur `loadTerrains` | Remplir le terrain de toute la grille en un message au lieu de centaines de `paint` | Prise  |
| 2026-06-28 | Pas de `React.StrictMode` sur l'app | Le double-montage des effets en dev rejouait l'init impérative Leaflet + les abonnements IPC (`window.engine`, sans désabonnement) → doublons/races | Prise  |
| 2026-06-28 | Vite : préférer les sources `.ts` aux `.js` du moteur (`resolve.extensions`) | `engine/*.js` (CommonJS, pour le worker Node) cassait l'analyse ESM de Rollup ; le renderer consomme les sources `.ts` | Prise  |
| 2026-06-28 | UI convertie en **TypeScript** (`src/ui/*.tsx`) ; `tsconfig` UI dédié (lib DOM, jsx react), `typecheck` = root + UI | Lot 3 : tout le code applicatif neuf est typé ; `electron/` reste en JS (frontière) → migration JS→TS close | Prise  |
| 2026-06-28 | **Double ingestion OSM conservée — on NE converge PAS.** L'UI garde son propre fetch Overpass pour le raster (`src/ui/lib/terrainRaster.ts`) ; la couche `src/app/services` (GeoJSON classé) reste **Node-only** et non câblée au renderer | Les deux ne sont pas redondantes (raster d'affichage vs GeoJSON classifié pour scripts/tests) ; le cache `fs` de `src/app/services` est **inaccessible au renderer** (`contextIsolation`) ; converger = nouvelle feature (cache IndexedDB + changement de rendu) à risque pour un gain surtout cosmétique → statu quo assumé | Prise  |
| 2026-06-29 | **Météo stockée dans `SimState.weather`** (et non dans `HistoryManager`) | Transite naturellement par `step(state, rng)` → `computeIgnitionProb` sans casser la signature pure ; un changement passe par `applyAndInvalidate` (invalidation des ticks > t gratuite, cohérent avec `paint`/`ignite`) | Prise  |
| 2026-06-29 | **Message worker `setWeather { weather }`** (plutôt qu'étendre `init`) ; `init`/`reset` partent en `NEUTRAL_WEATHER` | Prépare l'outil « vent » de P2 et la mise à jour live de la météo ; sépare la géométrie (`init`) de la météo | Prise  |
| 2026-06-29 | **Convention vent** : `windDirection` = direction d'OÙ vient le vent (convention météo/Open-Meteo) dans le code ; le feu pousse vers `windDirection + 180°`. La flèche de l'UI est retournée (affichage seul) pour pointer là où le vent pousse | Cohérence avec les données Open-Meteo déjà récupérées ; flèche intuitive sans altérer la donnée | Prise  |
| 2026-06-29 | **Vitest projet `node` : préférer les sources `.ts`** aux `.js` compilés du moteur (`resolve.extensions`) | Sans ça, les tests tournaient sur `engine/*.js` périmés (artefacts de `build:engine`) ; aligné avec `vite.config.js` (décision 2026-06-28) | Prise  |

## À trancher

Questions ouvertes que l'équipe doit résoudre ensemble (ajouter ici la décision dès
qu'elle est arrêtée, puis la déplacer vers le tableau ci-dessus).

- **Inflammabilité du terrain urbain** : `RESIDENTIAL` (0.45) et `INDUSTRIAL` (0.55) brûlent
  presque comme la forêt — le feu se propage sur le béton. Faut-il en faire des coupe-feu
  (flammability 0), réduire fortement leur inflammabilité (interface forêt-ville), ou garder
  le modèle wildland-urban ? Lié : le défaut d'échantillonnage du raster mappe les pixels
  **non classés** (`#e8e4d8`) vers `GRASSLAND` (inflammable) — à passer en terrain ininflammable ?
- **Coordonnées de la grille hexagonale** : offset ou axiales ?
- **Durée de combustion** : combien de ticks avant qu'une cellule en feu passe à « brûlée » ?
- **Migration JS → TypeScript** : le **nouveau** code est en TS (décision 2026-06-25) ;
  `src/renderer.js` (stub) est supprimé et l'UI portée passe en `.tsx` (lot 3, décision
  2026-06-28) ; **`electron/` reste volontairement en JS** (décision 2026-06-28). Plus de
  code applicatif JS à migrer — question close.
