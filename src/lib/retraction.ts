// The partial retraction setting is piston travel in mm (the backend accepts
// 36.26 to 67.99 mm); people pick it as a water volume. Same conversion and
// range as the Dial (meticulous-dial src/utils/retraction.ts).
const PISTON_RADIUS_MM = 26.5;
const PISTON_AREA_MM2 = Math.PI * PISTON_RADIUS_MM * PISTON_RADIUS_MM;

export const RETRACTION_MIN_ML = 80;
export const RETRACTION_MAX_ML = 150;
export const RETRACTION_DEFAULT_ML = 100;

export const retractionMmToMl = (distanceMm: number) =>
  Math.round((PISTON_AREA_MM2 * distanceMm) / 1000);

export const retractionMlToMm = (volumeMl: number) =>
  Math.round((volumeMl * 1000 * 100) / PISTON_AREA_MM2) / 100;
