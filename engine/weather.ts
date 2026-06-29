import { Weather } from './types'

// Météo neutre : tous les facteurs valent 1 → comportement identique à un moteur sans météo
// (garantit la non-régression des simulations existantes). Les valeurs de référence des
// facteurs ci-dessous (20 °C, 40 % air, 12 % combustible) collent à cette météo neutre.
export const NEUTRAL_WEATHER: Weather = {
  windDirection: 0,
  windSpeed:     0,
  temperature:   20,
  humidity:      40,
  fuelMoisture:  12,
}

// ─── Coefficients d'équilibrage (cf. docs/decisions.md « À trancher ») ───────────────
// Chaque sous-facteur vaut 1 à la valeur de référence (météo neutre) ; on s'en écarte
// linéairement. Le diviseur règle la sensibilité (plus petit = plus sensible).
const TEMP_REF = 20,  TEMP_DIV = 40   // °C
const HUM_REF  = 40,  HUM_DIV  = 120  // % air
const FUEL_REF = 12,  FUEL_DIV = 60   // % combustible

// Vent : windStrength ∈ [0, WIND_COEFF] croît avec windSpeed jusqu'à WIND_SPEED_REF km/h.
// windFactor = 1 + windStrength·cos(Δ) reste alors dans [1 − WIND_COEFF, 1 + WIND_COEFF].
const WIND_COEFF     = 0.9
const WIND_SPEED_REF = 50 // km/h pour atteindre la pleine intensité directionnelle

/**
 * Facteur scalaire global (≥ 0) appliqué à la probabilité d'ignition selon température,
 * humidité de l'air et humidité du combustible. Météo neutre ⇒ 1.
 */
export function weatherIgnitionFactor(w: Weather): number {
  const tempFactor = 1 + (w.temperature - TEMP_REF) / TEMP_DIV   // plus chaud ⇒ > 1
  const humFactor  = 1 + (HUM_REF - w.humidity) / HUM_DIV         // plus humide ⇒ < 1
  const fuelFactor = 1 + (FUEL_REF - w.fuelMoisture) / FUEL_DIV   // combustible humide ⇒ < 1
  return Math.max(0, tempFactor * humFactor * fuelFactor)
}

/**
 * Durée de combustion effective : un combustible humide brûle un peu plus longtemps.
 * `burnDuration = 0` (eau, roche) reste 0.
 */
export function effectiveBurnDuration(burnDuration: number, w: Weather): number {
  if (burnDuration === 0) return 0
  return Math.max(1, Math.round(burnDuration * (1 + w.fuelMoisture / 50)))
}

/**
 * Multiplicateur directionnel (≥ 0) pour un voisin en feu, selon l'alignement du cap de
 * propagation (voisin → cellule, en degrés compas) avec la direction où le vent pousse.
 * Convention météo : `windDirection` = direction d'OÙ vient le vent ⇒ il pousse vers
 * `windDirection + 180°`. Vent nul ⇒ 1.
 */
export function windNeighborFactor(propagationBearingDeg: number, w: Weather): number {
  const windStrength = Math.min(w.windSpeed / WIND_SPEED_REF, 1) * WIND_COEFF
  if (windStrength === 0) return 1
  const pushBearing = w.windDirection + 180
  const deltaRad = ((propagationBearingDeg - pushBearing) * Math.PI) / 180
  return Math.max(0, 1 + windStrength * Math.cos(deltaRad))
}
