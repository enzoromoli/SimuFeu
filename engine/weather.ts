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
