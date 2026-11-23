/**
 * Geometry and snapping for the "gravity well" speed picker (mobile and
 * desktop). Each playback rate is a concentric orbit: the slowest rate is the
 * outermost ring, the fastest the innermost. A touch's distance from the
 * centre picks the rate.
 *
 * The functions carry the 'worklet' directive so the mobile app can call them
 * on the UI thread from Reanimated; elsewhere the directive is a no-op string.
 * Default parameters are literals on purpose: the worklet plugin doesn't
 * capture module constants used in defaults (they're undefined on the UI
 * thread). A test keeps them in step with RATE_MIN / RATE_MAX / RATE_STEP.
 */

export const RATE_MIN = 0.7;
export const RATE_MAX = 2.0;
export const RATE_STEP = 0.1;

/** Fraction of the well's diameter taken by the innermost and outermost orbits. */
export const WELL_INNER = 0.17;
export const WELL_OUTER = 0.43;

export type WellBand = "slow" | "normal" | "brisk" | "turbo";

/** Round to one decimal so float steps (0.1 + 0.2…) compare equal. */
function round1(n: number): number {
  "worklet";
  return Math.round(n * 10) / 10;
}

/** The nearest allowed rate, clamped to [min, max]. */
export function snapRate(rate: number, min = 0.7, max = 2, step = 0.1): number {
  "worklet";
  if (!Number.isFinite(rate)) return 1;
  const snapped = min + Math.round((rate - min) / step) * step;
  return round1(Math.min(max, Math.max(min, snapped)));
}

/** Every allowed rate, slowest first. */
export function wellRates(min = 0.7, max = 2, step = 0.1): number[] {
  const count = Math.round((max - min) / step) + 1;
  return Array.from({ length: count }, (_, i) => round1(min + i * step));
}

/** 0 for the fastest rate (inner orbit) to 1 for the slowest (outer orbit). */
export function rateToNorm(rate: number, min = 0.7, max = 2): number {
  "worklet";
  return Math.min(1, Math.max(0, (max - rate) / (max - min)));
}

/** Orbit radius for a rate, in the same units as `size`. */
export function orbitRadius(rate: number, size: number, min = 0.7, max = 2): number {
  "worklet";
  const inner = size * WELL_INNER;
  const outer = size * WELL_OUTER;
  return inner + rateToNorm(rate, min, max) * (outer - inner);
}

/** Radius for a normalised orbit position (0 inner, 1 outer). */
export function normRadius(norm: number, size: number): number {
  "worklet";
  const inner = size * WELL_INNER;
  return inner + norm * (size * WELL_OUTER - inner);
}

/** Normalised orbit position (0 inner, 1 outer, clamped) for a distance from the centre. */
export function distanceToNorm(distance: number, size: number): number {
  "worklet";
  const inner = size * WELL_INNER;
  const outer = size * WELL_OUTER;
  return Math.min(1, Math.max(0, (distance - inner) / (outer - inner)));
}

/** The snapped rate for a distance from the centre. */
export function rateAtDistance(distance: number, size: number, min = 0.7, max = 2, step = 0.1): number {
  "worklet";
  return snapRate(max - distanceToNorm(distance, size) * (max - min), min, max, step);
}

/** Radius of the centre "core" (tap it to reset to 1.0×). */
export function coreRadius(size: number): number {
  "worklet";
  return size * WELL_INNER * 0.68;
}

/** Which colour band a rate falls in. */
export function wellBand(rate: number): WellBand {
  "worklet";
  const r = round1(rate);
  if (r < 1) return "slow";
  if (r === 1) return "normal";
  if (r <= 1.5) return "brisk";
  return "turbo";
}

const BAND_LABEL: Record<WellBand, string> = {
  slow: "Deep orbit",
  normal: "Synced orbit",
  brisk: "Inner orbit",
  turbo: "Hyper orbit",
};

export const wellBandLabel = (rate: number): string => BAND_LABEL[wellBand(rate)];

/** Radians per second the satellite travels at a rate: faster rates orbit faster. */
export function orbitVelocity(rate: number): number {
  "worklet";
  return Math.pow(rate, 1.35) * 2.2;
}
