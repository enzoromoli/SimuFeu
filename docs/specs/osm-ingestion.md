# Spec — Ingestion OSM (bbox → terrains classés)

## Objectif
Permettre à l'app layer de récupérer les données OpenStreetMap d'une zone (via
l'API Overpass), de les normaliser et de les classer par type de terrain, de façon
autonome et testable — brique d'entrée du futur remplissage de la grille de simulation.
Pour : l'équipe SimuFeu (consommé plus tard par l'étape grille / l'engine).

## Entrées / sorties
- Entrées : une bbox sous forme d'objet NOMMÉ
    type Bounds = { south: number; west: number; north: number; east: number }  // lat/lon
- Sorties :
    * un GeoJSON FeatureCollection normalisé des objets OSM de la zone,
    * chaque feature classée en TerrainType,
    * une distribution (nombre de features par TerrainType).
- Effet de bord isolé : appel réseau Overpass + lecture/écriture de cache.

## Règles
- Langage TypeScript. (SUPERSEDE la note "JS pour l'instant" de CLAUDE.md — l'engine est
  déjà en TS ; acter dans decisions.md.)
- UNE SEULE requête Overpass : union de TOUS les osmTags (pas une requête par catégorie),
  avec garde-fous timeout/maxsize raisonnables.
- Endpoint par défaut https://overpass-api.de/api/interpreter, dans un module de config,
  surchargeable par variable d'environnement (miroirs de secours en commentaire).
- Conversion vers l'ordre Overpass (sud, ouest, nord, est) faite À L'INTÉRIEUR du client,
  jamais exposée à l'appelant.
- Source des tags = COPIE LOCALE de l'enum TerrainType et de la table osmTags de l'engine
  (branche simu-engine NON mergée → interdiction d'importer depuis engine/ ; resync au
  merge, à noter dans decisions.md). Gérer les wildcards (ex 'waterway=*').
- Classifieur = fonction PURE feature OSM -> TerrainType. Feature sans tag reconnu ->
  IGNORÉE pour l'instant (règle réversible, à consigner dans decisions.md).
- Normalisation Overpass -> GeoJSON via la lib osmtogeojson (choix retenu vs fait maison).
- Cache : JSON, clé = hash(bbox + requête normalisées), TTL très grand. Placé DERRIÈRE
  UNE INTERFACE (get/set) ; implémentation fichiers (fs) pour script/tests Node maintenant,
  implémentation stockage navigateur (IndexedDB) plus tard côté renderer. Le renderer n'a
  PAS accès à fs (contextIsolation:true / nodeIntegration:false) → ne PAS toucher au main
  process / preload.
- Fonctions pures partout sauf l'effet de bord réseau, qui est isolé. JAMAIS Math.random
  (règle aléatoire-à-graine de CLAUDE.md).
- Dépendances : osmtogeojson (runtime), @types/geojson (dev). fetch natif Node 18+
  (si Node < 18, prévoir node-fetch). Pas de React/Zustand/Leaflet/Turf.
- Outillage : vérifier la présence de TypeScript + Vitest sur `dev` (ajoutés sur la branche
  engine, non mergée) ; les mettre en place si absents, sans casser l'existant.
- Emplacement des fichiers (créer UNIQUEMENT les siens) :
    src/app/services/overpass.ts         (client Overpass)
    src/app/services/overpass.config.ts   (endpoint + paramètres)
    src/app/services/osmCache.ts          (interface cache + impl fs)
    src/domain/types.ts                   (Bounds + types OSM/GeoJSON + copie TerrainType)
    src/domain/osmClassify.ts             (classifieur pur)

## Critères d'acceptation
- [ ] Une fonction prend un Bounds et renvoie le GeoJSON classé + la distribution.
- [ ] La requête Overpass couvre tous les osmTags en un seul appel et est mise en cache.
- [ ] Un second appel sur la même bbox lit le cache sans rappeler le réseau.
- [ ] Le classifieur mappe correctement chaque tag connu vers son TerrainType, wildcards
      compris, et ignore les features sans tag reconnu.
- [ ] Suite de tests Vitest 100 % OFFLINE (réseau mocké via fixture). Au moins un test
      par fonction non triviale.
- [ ] UN test "vrai réseau" isolé/opt-in (non lancé par défaut).
- [ ] Un script Node fetch une vraie bbox et affiche la distribution des terrains.
- [ ] Chaque choix technique est consigné dans docs/decisions.md.

## Hors scope
- Construction de la grille hexagonale et géoréférencement (bbox -> radius, origine,
  projection) : autre feature.
- Tout message vers l'engine (paint/init/…) et tout import depuis engine/.
- Toute modification de l'UI (src/ui/), de Leaflet, du main process / preload.
- Recouvrement géométrique hexagone↔polygone (pas de Turf).
- Mode hors-ligne complet et système de sauvegarde (seul le cache TTL est prévu).

## Décisions liées (à reporter dans docs/decisions.md, date 2026-06-25)
- Nouveau code en TypeScript (fait avancer "Migration JS → TypeScript" de "À trancher").
- Bbox en objet nommé Bounds (évite les bugs d'ordre positionnel).
- Overpass : une seule requête, endpoint configurable.
- osmtogeojson retenu pour la normalisation.
- Copie locale de TerrainType/osmTags (engine non mergé), à resynchroniser au merge.
- Feature OSM sans tag reconnu : ignorée (réversible).
- Cache derrière une interface (fs maintenant, IndexedDB plus tard).
