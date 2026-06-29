# Spec — La météo pilote la propagation du feu (P1)

> Cœur de la simulation. Rendre **effective** la météo collectée par l'écran de config
> (vent, température, humidité de l'air, humidité du combustible) sur le moteur.

## Objectif

Aujourd'hui le panneau « Paramètres » est décoratif : la météo collectée dans `SimParams`
n'atteint jamais le moteur, et `computeIgnitionProb` ignore vent et météo. Deux simulations
avec des météos opposées donnent un feu identique. On veut que la météo **transite** jusqu'au
moteur puis **module** la propagation, pour des pompiers qui dimensionnent une intervention.

## Entrées / sorties

- **Entrées** : `Weather { windDirection, windSpeed, temperature, humidity, fuelMoisture }`
  émis par l'UI (dérivé de `SimParams`) via le message worker `setWeather`.
- **Sorties** : la météo est stockée dans `SimState.weather` ; elle modifie la probabilité
  d'ignition (`computeIgnitionProb`) et la durée de combustion (`step`). Changer la météo
  invalide les ticks > tick courant (régénérés à la demande).

## Règles

- `windDirection` suit la **convention météo** : direction *d'où vient* le vent (comme
  Open-Meteo). Le feu se propage donc préférentiellement vers `windDirection + 180°`.
- Le moteur reste **pur et déterministe** : même graine + même météo ⇒ même historique.
- **Météo neutre** (`NEUTRAL_WEATHER` : vent 0 km/h, 20 °C, 40 % air, 12 % combustible) ⇒
  tous les facteurs valent 1 ⇒ comportement identique à l'actuel (non-régression).
- Scalaires globaux (mêmes pour toute la grille), facteur multiplicatif ≥ 0 sur la proba :
  - température : `1 + (T − 20)/40` (plus chaud ⇒ plus probable).
  - humidité air : `1 − humidity/200` (plus humide ⇒ moins probable).
  - humidité combustible : `1 − fuelMoisture/60` (combustible humide ⇒ moins probable).
- Durée de combustion effective : `round(burnDuration · (1 + fuelMoisture/50))`, min 1 ;
  `burnDuration = 0` (eau, roche) reste 0.
- Vent directionnel : la contribution de chaque voisin en feu est pondérée par
  `1 + windStrength · cos(Δ)` où Δ = écart entre le cap de propagation (voisin → cellule) et
  le cap « le vent pousse vers » (`windDirection + 180°`) ; `windStrength` croît avec
  `windSpeed`. Sous le vent ⇒ > 1, à contre-vent ⇒ < 1 (borné ≥ 0). Vent nul ⇒ 1.
- Les coefficients ci-dessus sont des **valeurs d'équilibrage** (consignées « À trancher »
  dans `decisions.md`), ajustables sans changer l'architecture.

## Critères d'acceptation

- [ ] La météo réglée dans la config atteint le moteur (message `setWeather`).
- [ ] Météo neutre ⇒ tests moteur existants inchangés (non-régression).
- [ ] Chaud + sec augmente la probabilité d'ignition ; humide la diminue.
- [ ] Humidité combustible élevée allonge la durée de combustion.
- [ ] À conditions égales, un voisin **sous le vent** ignite plus probablement qu'à contre-vent.
- [ ] `windSpeed = 0` ⇒ propagation symétrique (identique au sans-vent).
- [ ] Déterminisme conservé (même graine + météo ⇒ même déroulé).
- [ ] La flèche de vent de l'UI pointe là où le vent pousse (affichage seul).

## Hors scope

- **Sautes de feu / braises** (`// TODO: ember`) → P3.
- **Rafales** (`windGust`) non utilisées par le moteur en P1 (réservées aux braises P3).
- Outils de simu non câblés, fond de carte OSM, grille hexagonale pleine → P2.

## Décisions liées

- `decisions.md` : modèle de données (météo dans `SimState`), message `setWeather`,
  convention de direction du vent, coefficients d'équilibrage (« À trancher »).
