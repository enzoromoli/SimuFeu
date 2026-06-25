/**
 * Configuration du client Overpass.
 *
 * L'endpoint par défaut est surchargeable via la variable d'environnement
 * `OVERPASS_ENDPOINT` (utile pour pointer vers un miroir si l'instance principale
 * est saturée).
 */

/** Endpoint Overpass par défaut. */
const DEFAULT_ENDPOINT = 'https://overpass-api.de/api/interpreter'

// Miroirs de secours (à basculer via OVERPASS_ENDPOINT en cas de saturation) :
//   https://overpass.kumi.systems/api/interpreter
//   https://maps.mail.ru/osm/tools/overpass/api/interpreter
//   https://overpass.openstreetmap.fr/api/interpreter

export interface OverpassConfig {
  /** URL de l'API Overpass. */
  endpoint: string
  /** Garde-fou : délai max de calcul côté serveur, en secondes ([timeout:...]). */
  timeoutSeconds: number
  /** Garde-fou : taille mémoire max de la requête, en octets ([maxsize:...]). */
  maxSizeBytes: number
  /**
   * En-tête User-Agent identifiant l'app. REQUIS : overpass-api.de renvoie 406 via
   * mod_security si la requête n'a pas de User-Agent. (Ignoré côté navigateur, où l'UA
   * est imposé par le runtime.)
   */
  userAgent: string
}

/** Valeurs de garde-fous raisonnables pour une bbox de zone d'intervention. */
export const OVERPASS_DEFAULTS = {
  timeoutSeconds: 60,
  maxSizeBytes: 536870912, // 512 Mo
  userAgent: 'SimuFeu/1.0 (https://github.com/simufeu; feu de forêt)',
} as const

/**
 * Construit la configuration Overpass effective.
 * `env` est injectable pour les tests (défaut : `process.env`).
 */
export function getOverpassConfig(
  env: NodeJS.ProcessEnv = process.env,
): OverpassConfig {
  const endpoint = env['OVERPASS_ENDPOINT']?.trim()
  return {
    endpoint: endpoint && endpoint.length > 0 ? endpoint : DEFAULT_ENDPOINT,
    timeoutSeconds: OVERPASS_DEFAULTS.timeoutSeconds,
    maxSizeBytes: OVERPASS_DEFAULTS.maxSizeBytes,
    userAgent: OVERPASS_DEFAULTS.userAgent,
  }
}
