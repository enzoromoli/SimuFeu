# Spec — Gestion des ticks

## Objectif

Permettre de naviguer dans l'historique de la simulation (avancer, reculer, sauter à un tick donné) sans tout recalculer à chaque fois, tout en gardant une expérience utilisateur fluide.

## Entrées / sorties

- **Entrées** :
  - Navigation : avancer d'un tick, reculer d'un tick, ou sauter directement à un tick `t` donné
  - Modification de la map (obstacle, terrain, foyer initial) appliquée à un tick `t`
- **Sorties** :
  - État complet de toutes les cellules au tick `t` demandé
  - Indicateur de chargement si un calcul est en cours
  - Tick max actuellement généré (pour les bornes de navigation côté UI)

## Règles

- Chaque tick contient l'état complet de toutes les cellules de la map (pas de diff partiel)
- La génération de nouveaux ticks s'arrête lorsqu'aucune cellule n'est `en_feu` (toutes les cellules restantes sont `intact` ou `brûlé`)
- Toute modification de la map à un tick `t` invalide et régénère tous les ticks postérieurs à `t`
- La génération étant stochastique, la régénération après modification doit s'appuyer sur une seed déterministe pour garantir la reproductibilité du scénario : à seed et scénario initial identiques, la séquence de ticks doit être identique
- Reculer dans l'historique ne déclenche jamais de recalcul : c'est une simple lecture d'un tick déjà généré
- Avancer au-delà du dernier tick généré déclenche le calcul du/des tick(s) manquant(s)
- Impossible de naviguer avant le tick 0 (état initial)

## Critères d'acceptation

- [ ] Accès à l'état de toutes les cellules à un tick donné `t` (0 ≤ t ≤ tick_max)
- [ ] Navigation avant et arrière sans erreur, y compris aux bornes (tick 0 et tick_max)
- [ ] Modification de la map à un tick `t` régénère exactement les ticks > t, sans toucher aux ticks ≤ t
- [ ] Arrêt automatique de la génération quand plus aucune cellule n'est `en_feu`
- [ ] Affichage d'un indicateur de chargement si le calcul d'un tick prend un temps perceptible
- [ ] À seed et scénario identiques, deux exécutions produisent exactement la même séquence de ticks

## Hors scope

- Pas de frontend (tests en terminal uniquement)
- Pas de sauvegarde persistante de l'historique entre sessions (pas d'export/import de ticks)
- Pas d'undo/redo multi-branches (une seule ligne d'historique, pas de fork de scénario)

## Décisions liées

- Génération de tous les ticks avant le début de la simu, ou génération en temps réel (lazy) ?
- Stockage : snapshot complet par tick (simple, mémoire ↑) vs diff entre ticks (mémoire ↓, lecture plus complexe) ?
- Structure de données pour l'historique : array indexé par tick vs `Map<number, État>` ?
- Gestion de la seed : une seed globale pour toute la simulation, ou une seed dérivée par tick (pour permettre une régénération partielle déterministe à partir d'un tick `t`) ?