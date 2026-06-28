const SCALE = [
  { force: 0, max: 1, label: 'Calme', level: 'calm' },
  { force: 1, max: 5, label: 'Très légère brise', level: 'calm' },
  { force: 2, max: 11, label: 'Légère brise', level: 'calm' },
  { force: 3, max: 19, label: 'Petite brise', level: 'moderate' },
  { force: 4, max: 28, label: 'Jolie brise', level: 'moderate' },
  { force: 5, max: 38, label: 'Bonne brise', level: 'moderate' },
  { force: 6, max: 49, label: 'Vent frais', level: 'strong' },
  { force: 7, max: 61, label: 'Grand frais', level: 'strong' },
  { force: 8, max: 74, label: 'Coup de vent', level: 'severe' },
  { force: 9, max: 88, label: 'Fort coup de vent', level: 'severe' },
  { force: 10, max: 102, label: 'Tempête', level: 'severe' },
  { force: 11, max: 117, label: 'Violente tempête', level: 'extreme' },
  { force: 12, max: Infinity, label: 'Ouragan', level: 'extreme' },
];

export function getBeaufort(speedKmh) {
  return SCALE.find((entry) => speedKmh <= entry.max) ?? SCALE[SCALE.length - 1];
}
