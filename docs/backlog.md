# Backlog

Liste des manques fonctionnels et améliorations connus, à traiter par l'équipe.
Format : **quoi** + **où** (fichiers) + **priorité**. Les choix techniques actés vont
dans `decisions.md` ; les questions d'équilibrage ouvertes y sont en « À trancher ».

Priorités : **P1** (cœur de la simulation), **P2** (interactions / UX), **P3** (réalisme avancé / livraison).

## P1 — Cœur de la simulation

- **Les paramètres météo n'atteignent pas le moteur.** L'écran de config collecte vent,
  température, humidité, humidité du combustible, mais le moteur ne les reçoit pas : le
  message `init` ne prend que `radius`/`seed` ([engine/worker.ts](../engine/worker.ts)),
  et l'envoi des params a été retiré de [App.tsx](../src/ui/App.tsx). Le panneau
  « Paramètres » est donc actuellement décoratif côté simulation.
  → Faire transiter les params config → moteur (étendre `init`/`loadTerrain` ou nouveau `setWeather`).
- **Vent dans la propagation.** TODO explicite dans
  [engine/simEngine.ts](../engine/simEngine.ts) (`// TODO: wind`) : multiplicateur
  directionnel dans `computeIgnitionProb` (le feu se propage plus vite/loin dans le sens du vent).
- **Température / humidité / humidité du combustible** → moduler la probabilité d'ignition
  et la durée de combustion (aujourd'hui `terrainConfig` est statique).

## P2 — Interactions & UX

- **Outils de la vue de simu non câblés.** Seul `feu` → `ignite` fonctionne
  ([SimulationView.tsx](../src/ui/components/SimulationView.tsx)). À brancher : `vegetation`
  (peindre un terrain → message `paint`), `effacer`, `dessiner`, `vent`, `données`. Le moteur
  gère déjà `paint` + l'invalidation/régénération des ticks > t (cf.
  [docs/specs/ticks_management.md](specs/ticks_management.md)).
- **Carte incohérente entre config et simulation.** La config affiche les tuiles
  OpenStreetMap (rues, labels) ; la vue de simu n'affiche que le raster terrain quantifié,
  sans tuiles. → Ajouter les tuiles OSM en fond dans
  [SimulationView.tsx](../src/ui/components/SimulationView.tsx) + raster terrain
  semi-transparent (ou activable), pour que la simu ressemble à la config + le feu par-dessus.
- **Grille hexagonale ⇒ coupe diagonale aux coins de la zone.** La grille moteur est un gros
  hexagone ([makeGrid](../engine/hexUtils.ts)) mappé sur une zone rectangulaire ; les 4 coins
  du rectangle n'ont pas de cellules, donc le feu s'arrête en diagonale et une partie de la
  zone dessinée n'est jamais simulée. → Générer une grille hexagonale qui **remplit le
  rectangle** (rangées décalées couvrant toute la bbox) au lieu d'un hexagone — modif
  `makeGrid` + [geoGrid.ts](../src/domain/geoGrid.ts).
- **Équilibrage du terrain** (urbain qui brûle, durées de combustion) — questions ouvertes
  détaillées dans `decisions.md` (« À trancher »).

## P3 — Réalisme avancé & livraison

- **Sautes de feu / braises.** TODO explicite dans
  [engine/simEngine.ts](../engine/simEngine.ts) (`// TODO: ember`) : ignition longue portée
  projetée par le vent.
- **Packaging `.exe`.** Tester `npm run build:win` (electron-builder, cible NSIS) → l'installeur
  est le livrable. Vérifier l'app packagée (chargement `src/ui/dist`, worker
  `engine/worker.js`, icône).

## Hors backlog (dette d'archi tracée ailleurs)

- Convergence des deux ingestions OSM / câblage de `src/app/services` au renderer : **décision
  prise de ne pas le faire** (voir `decisions.md`).
