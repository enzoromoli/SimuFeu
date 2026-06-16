# Journal de décisions

Ce fichier trace les choix techniques du projet. **Format : une ligne par décision**,
indiquant **quoi** (la décision) et **pourquoi** (la raison). On ajoute une ligne dès
qu'un choix technique est arrêté, pour garder une trace partagée par l'équipe.

Statut : `Prise` (actée, souvent déjà dans le code) ou `À trancher` (voir section dédiée).

## Décisions prises

| Date       | Décision                                                                 | Pourquoi                                                                 | Statut |
|------------|--------------------------------------------------------------------------|--------------------------------------------------------------------------|--------|
| 2026-06-15 | Electron comme conteneur de l'application de bureau                       | Livrable `.exe` multi-OS, UI web réutilisable, accès Node pour le moteur  | Prise  |
| 2026-06-15 | electron-builder, cible NSIS Windows (`build:win`)                        | Produire l'installeur `.exe` attendu comme livrable                       | Prise  |
| 2026-06-15 | Moteur de simulation isolé dans un Worker Thread (`engine/worker.js`)     | Séparer la logique de calcul de l'UI, ne pas bloquer le thread du renderer | Prise  |
| 2026-06-15 | Communication UI <-> moteur via IPC Electron + `contextBridge` (preload)  | Pont sûr entre renderer et main, qui relaie ensuite vers le worker        | Prise  |
| 2026-06-15 | `contextIsolation: true` / `nodeIntegration: false`                      | Bonne pratique de sécurité Electron : isoler le renderer de Node          | Prise  |

## À trancher

Questions ouvertes que l'équipe doit résoudre ensemble (ajouter ici la décision dès
qu'elle est arrêtée, puis la déplacer vers le tableau ci-dessus).

- **Coordonnées de la grille hexagonale** : offset ou axiales ?
- **Durée de combustion** : combien de ticks avant qu'une cellule en feu passe à « brûlée » ?
- **Migration JS → TypeScript** : quand et comment migrer le code existant vers TS strict ?
