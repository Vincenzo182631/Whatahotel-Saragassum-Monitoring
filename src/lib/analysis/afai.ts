// Maps USF/NOAA AFAI (Alternative Floating Algae Index) satellite values to a
// 0-100 beach score. Higher AFAI = more floating sargassum = lower beach score.
//
// AFAI is a reflectance index (typical range ~ -0.002 .. 0.004; it saturates
// at the high end under sun glint / thick features). The CLEAR/HEAVY thresholds
// below are a calibration heuristic that turns the raw index into a
// consumer-facing clarity score — tune them as ground-truth improves.

export const AFAI_CLEAR = 0.0002; // at/below this: essentially clear water
export const AFAI_HEAVY = 0.0038; // at/above this: heavy sargassum signal

/** Convert a representative AFAI value (e.g. a box median) to a 0-100 score. */
export function afaiToScore(representativeAfai: number): number {
  const density = Math.max(
    0,
    Math.min(1, (representativeAfai - AFAI_CLEAR) / (AFAI_HEAVY - AFAI_CLEAR)),
  );
  return Math.round(100 - density * 100);
}

/** Median of the finite values in the list, or null if there are none. */
export function median(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 === 1 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}
