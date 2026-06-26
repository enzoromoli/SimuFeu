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

## À trancher

Questions ouvertes que l'équipe doit résoudre ensemble (ajouter ici la décision dès
qu'elle est arrêtée, puis la déplacer vers le tableau ci-dessus).

- **Coordonnées de la grille hexagonale** : offset ou axiales ?
- **Durée de combustion** : combien de ticks avant qu'une cellule en feu passe à « brûlée » ?
- **Migration JS → TypeScript** : le **nouveau** code est désormais en TS (décision 2026-06-25) ;
  reste à trancher *quand/comment* migrer le code **existant** (`electron/`, `src/renderer.js`) vers TS strict.
