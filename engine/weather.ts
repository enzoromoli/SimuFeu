import { Weather } from './types'

// Météo neutre : tous les facteurs valent 1 → comportement identique à un moteur sans météo
// (garantit la non-régression des simulations existantes).
export const NEUTRAL_WEATHER: Weather = {
  windDirection: 0,
  windSpeed:     0,
  temperature:   20,
  humidity:      40,
  fuelMoisture:  12,
}
