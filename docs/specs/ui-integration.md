# Spec — Intégration de l'UI (config + simu) sur `dev`

## Objectif

Amener les fonctionnalités d'interface développées sur `feat/settings-page` (écran de
configuration + vue de simulation, en React) sur la base `dev` (qui porte le moteur TS, la
couche d'ingestion OSM et l'outillage tests), de façon **cohérente avec l'architecture en
couches** du projet, puis faire fonctionner cette UI **avec le moteur réel**, et enfin
migrer l'UI en **TypeScript** — le tout sans régression du moteur ni des tests existants.
Pour : l'équipe SimuFeu (le livrable est l'app desktop Electron complète).

## Entrées / sorties

- **Entrées** : l'UI React existante (`feat/settings-page`, en JSX) ; le moteur et son
  protocole worker (`dev`, en TS) ; la couche domaine/services OSM (`dev`).
- **Sorties** : une branche `feat/ui-integration` issue de `dev` où l'app démarre, l'écran
  de config et la vue de simu s'affichent dans la couche `src/ui/`, puis (lot 2) sont
  pilotés par le moteur, puis (lot 3) sont écrits en TypeScript.

## Règles

- **Architecture en couches** (cf. `osm-ingestion.md`) : `engine/` (moteur TS), `src/domain`
  (métier pur), `src/app/services` (services), **`src/ui/` (interface React, NOUVELLE
  couche)**, `electron/` (conteneur). `vite root = src/ui`.
- On **porte** l'UI sur une branche neuve depuis `dev` ; on ne **merge pas**
  `feat/settings-page` (divergée avant le moteur, contient un stub `engine/worker.js` et
  aucun fichier moteur TS).
- **Un axe modifié à la fois** : structure (lot 1) → branchement (lot 2) → typage (lot 3).
  Chaque étape se clôt par une **porte de test verte**.
- **Garde-fou permanent** : `npm test` + `npm run typecheck` + `npm run build:engine`
  doivent rester verts à chaque étape.
- **Nouveau code en TypeScript strict** (décision 2026-06-25). L'UI portée est convertie en
  `.tsx` au lot 3 ; `electron/*.js` reste en JS (frontière petite et stable).
- Le moteur reste **agnostique géographiquement** : le géoréférencement de la grille
  (bbox → rayon/origine, hex ↔ lat/lon) vit dans `src/domain`, pas dans `engine/`.
- Cohérence terrain (lot 2) : le terrain qui **pilote** la simulation et le terrain
  **affiché** proviennent de la **même source** (échantillonnage du raster OSM).
- Pas de `Math.random`/`Date.now` dans la logique moteur (règle aléatoire-à-graine).

## Critères d'acceptation

- [ ] **Lot 1** : `npm run dev` lance l'app depuis `dev` ; écran de config (carte +
      paramètres + météo) puis vue de simu **mock** s'affichent depuis `src/ui/`.
- [ ] **Lot 1** : harnais de test UI (vitest + jsdom + RTL) en place ; au moins un test de
      composant ; tests moteur de `dev` toujours verts.
- [ ] **Lot 2** : types du protocole worker partagés entre UI et `engine/`.
- [ ] **Lot 2** : la grille est géoréférencée sur la zone ; le terrain simulé = terrain
      affiché ; poser un foyer propage le feu tick par tick ; navigation avant/arrière ;
      arrêt automatique quand plus aucune cellule n'est en feu.
- [ ] **Lot 3** : `src/ui` en `.tsx`, `npm run typecheck` couvre l'UI, `npm run build:vite`
      OK, l'app fonctionne comme au lot 2.
- [ ] Chaque choix technique est consigné dans `docs/decisions.md`.

## Hors scope

- Refonte du moteur ou de la couche d'ingestion OSM existante.
- Migration de `electron/*.js` vers TypeScript (frontière laissée en JS volontairement).
- Grille hexagonale colorée comme **unique** représentation (le lot 2 fait 2 couches :
  raster terrain + feu) ; la grille unifiée est un polish optionnel de fin de projet.
- Persistance/export de l'historique entre sessions.

## Décisions liées (voir `docs/decisions.md`, date 2026-06-28)

- UI en React + Vite, isolée dans la couche `src/ui/` (`vite root = src/ui`).
- Port de l'UI sur branche neuve depuis `dev` (pas de merge de `feat/settings-page`).
- Cohabitation outillage Vite (renderer) + tsc (engine) + vitest, sans casser l'existant.
- Lot 2 : 2 couches (raster + feu), grille remplie par échantillonnage du raster.
- Géoréférencement de la grille = nouvelle feature (lève le hors-scope de `osm-ingestion.md`).
- `electron/` reste en JS (referme partiellement la migration JS→TS).
