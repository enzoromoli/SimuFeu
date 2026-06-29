# SimuFeu

Logiciel de bureau (Electron, livrable `.exe`) qui prédit l'évolution d'un feu de forêt
pour aider les pompiers à dimensionner leur intervention. Deux usages : **simulation
préventive** et **situation réelle** de départ de feu.

## Structure du dépôt

Monorepo léger (pas de workspaces). Le `package.json` racine porte les scripts et les
dépendances ; chaque sous-dossier a un `package.json` purement descriptif.

```
electron/   Processus principal Electron = le conteneur
  main.js     Crée la BrowserWindow (contextIsolation: true, nodeIntegration: false),
              charge src/index.html, démarre le moteur via worker_threads.Worker,
              relaie les messages UI <-> moteur (ipcMain 'engine:send' / 'engine:message').
  preload.js  Expose window.engine.{ send, onMessage } via contextBridge.
engine/     Moteur de simulation = logique isolée de l'UI
  worker.js   Node.js Worker Thread. Stub actuel (init -> ready). Future logique de sim.
src/        Renderer = UI + orchestration
  index.html, renderer.js, style.css
              Carte Leaflet, contrôles, fetch API Overpass, construction de la grille
              hexagonale. (Prévu — le renderer actuel est un stub.)
package.json  Racine : scripts dev / build / build:win (electron-builder, cible NSIS .exe).
```

**Flux de communication** (réel, tel qu'implémenté) :
`renderer (window.engine)` → IPC Electron (`contextBridge` / `ipcMain`) → `main.js`
→ `Worker.postMessage` → `engine/worker.js` → retour `parentPort.postMessage`
→ `webContents.send` → `renderer`. Le moteur tourne dans un **Worker Thread Node**, pas
dans le thread UI.

**Données externes** : tuiles OpenStreetMap, API Overpass.

## Méthode de travail — spec-driven (règle à suivre)

1. **Spec d'abord.** Pour chaque fonctionnalité, on écrit un spec court (objectif, règles,
   critères d'acceptation) à partir du gabarit `docs/specs/_TEMPLATE.md`.
2. **Plan validé avant code.** Tu proposes un plan ; l'équipe le relit et le **valide
   AVANT** toute écriture de code.
3. **Implémentation incrémentale.** Tâche par tâche : chaque diff est relu, on committe
   petit. Le code suit le spec.

Une **branche git par fonctionnalité**.

## Conventions cibles

> Migration vers TypeScript strict **en cours**, au fur et à mesure. Tout nouveau code est
> écrit en TS strict. Quand on touche un fichier `.js` existant, on le migre en `.ts` dans
> la foulée (pas de big-bang : on convertit progressivement, fichier par fichier).

- **TypeScript strict** pour tout nouveau code ; les fichiers JS touchés sont migrés en TS.
- **Moteur = fonctions pures** : signature `(état, params) -> nouvel état`, sans mutation
  ni effet de bord.
- **Aléatoire TOUJOURS via une graine injectée** — jamais `Math.random` directement
  (reproductibilité des simulations).
- **Au moins un test par fonction du moteur.**
- **Git** : une branche par feature, petits commits.

## Toujours

- **Proposer un plan avant de coder** et attendre la validation.
- **Consigner chaque choix technique** dans `docs/decisions.md` (une ligne : quoi + pourquoi).
- **Demander en cas d'ambiguïté** plutôt que deviner.

@docs/specs/_TEMPLATE.md
