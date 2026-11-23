import { describe, expect, it } from "vitest";
import {
  coreRadius,
  distanceToNorm,
  orbitRadius,
  RATE_MAX,
  RATE_MIN,
  RATE_STEP,
  rateAtDistance,
  rateToNorm,
  snapRate,
  wellBand,
  wellBandLabel,
  wellRates,
} from "./speedWell";

describe("snapRate", () => {
  it("snaps to the nearest step and clamps", () => {
    expect(snapRate(1.04)).toBe(1);
    expect(snapRate(1.06)).toBe(1.1);
    expect(snapRate(0.1)).toBe(RATE_MIN);
    expect(snapRate(9)).toBe(RATE_MAX);
  });

  it("returns exact one-decimal values (no float drift)", () => {
    expect(snapRate(0.7 + 0.1 + 0.1 + 0.1)).toBe(1);
    expect(snapRate(1.3000000000000003)).toBe(1.3);
  });

  it("treats non-finite input as 1×", () => {
    expect(snapRate(Number.NaN)).toBe(1);
  });

  it("snaps relative to min when min is off the step grid", () => {
    expect(snapRate(1.1, 0.75, 2, 0.25)).toBe(1);
    expect(snapRate(1.2, 0.75, 2, 0.25)).toBe(1.3); // 1.25, rounded to one decimal
  });
});

describe("defaults", () => {
  it("match RATE_MIN / RATE_MAX / RATE_STEP (they're literals for the worklet plugin)", () => {
    expect(snapRate(0)).toBe(RATE_MIN);
    expect(snapRate(99)).toBe(RATE_MAX);
    expect(wellRates()).toEqual(wellRates(RATE_MIN, RATE_MAX, RATE_STEP));
    expect(rateToNorm(RATE_MIN)).toBe(rateToNorm(RATE_MIN, RATE_MIN, RATE_MAX));
  });
});

describe("wellRates", () => {
  it("lists 0.7× to 2.0× in 0.1 steps", () => {
    const rates = wellRates();
    expect(rates).toHaveLength(14);
    expect(rates[0]).toBe(0.7);
    expect(rates.at(-1)).toBe(2);
    expect(rates).toContain(1);
  });
});

describe("geometry", () => {
  const size = 300;

  it("puts the slowest rate on the outer orbit and the fastest on the inner", () => {
    expect(rateToNorm(RATE_MIN)).toBe(1);
    expect(rateToNorm(RATE_MAX)).toBe(0);
    expect(orbitRadius(RATE_MAX, size)).toBeCloseTo(size * 0.17);
    expect(orbitRadius(RATE_MIN, size)).toBeCloseTo(size * 0.43);
  });

  it("round-trips every rate through its orbit radius", () => {
    for (const r of wellRates()) expect(rateAtDistance(orbitRadius(r, size), size)).toBe(r);
  });

  it("clamps distances inside the inner orbit and outside the outer one", () => {
    expect(distanceToNorm(0, size)).toBe(0);
    expect(distanceToNorm(size, size)).toBe(1);
    expect(rateAtDistance(0, size)).toBe(RATE_MAX);
    expect(rateAtDistance(size, size)).toBe(RATE_MIN);
  });

  it("keeps the core inside the innermost orbit", () => {
    expect(coreRadius(size)).toBeLessThan(orbitRadius(RATE_MAX, size));
  });
});

describe("wellBand", () => {
  it("bands slow, normal, brisk and turbo", () => {
    expect(wellBand(0.9)).toBe("slow");
    expect(wellBand(1)).toBe("normal");
    expect(wellBand(1.0000000001)).toBe("normal");
    expect(wellBand(1.5)).toBe("brisk");
    expect(wellBand(1.6)).toBe("turbo");
    expect(wellBandLabel(1)).toBe("Synced orbit");
  });
});
