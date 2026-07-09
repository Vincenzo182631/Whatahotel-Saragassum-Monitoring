// Analysis helpers for turning raw sargassum signals into a 0-100 beach score.
//
// Score is 0-100 where HIGHER = clearer beach (less sargassum), matching the
// rest of the system. These are transparent, free heuristics — no paid data.

/**
 * Convert a sargassum "density index" (0 = pristine, 1 = heavy inundation)
 * into a beach score. Used when a feed reports density/coverage rather than
 * an already-computed score.
 */
export function densityToScore(densityIndex: number): number {
  const d = Math.max(0, Math.min(1, densityIndex));
  return Math.round(100 - d * 100);
}

/**
 * Relative sargassum intensity for a given month (0 = off-season,
 * 1 = seasonal peak) for the tropical Atlantic / Caribbean belt. The Great
 * Atlantic Sargassum Belt typically peaks between late spring and summer.
 *
 * @param month 0-indexed month (0 = January).
 */
export function seasonalFactor(month: number): number {
  const byMonth = [0.1, 0.1, 0.3, 0.55, 0.8, 0.95, 1.0, 0.95, 0.7, 0.45, 0.2, 0.1];
  return byMonth[((month % 12) + 12) % 12];
}

/**
 * How susceptible a coastline is to sargassum, by latitude. Peaks around the
 * central Caribbean (~18°N) and tapers north (Florida / Bahamas) and south.
 * Returns 0..1.
 */
export function latitudeSusceptibility(latitude: number): number {
  const center = 18;
  const width = 7;
  return Math.exp(-Math.pow((latitude - center) / width, 2));
}

/**
 * Coarse seasonal estimate of a beach score from geography + time of year.
 * Deterministic (idempotent for a given month) and clearly a model, not an
 * observation. Intended as an out-of-the-box signal until a live feed is wired.
 */
export function estimateBeachScore(latitude: number, month: number): number {
  const MAX_PENALTY = 55;
  const penalty =
    MAX_PENALTY * seasonalFactor(month) * latitudeSusceptibility(latitude);
  return Math.max(0, Math.min(100, Math.round(95 - penalty)));
}
