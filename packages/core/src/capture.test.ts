import { describe, expect, it } from "vitest";
import { convexSiteUrl, JUST_ADDED_STEP_MS, JUST_ADDED_WINDOW_MS, justAddedSince } from "./capture";

describe("justAddedSince", () => {
  it("is 12 hours back, rounded down to the step", () => {
    const now = Date.UTC(2026, 10, 18, 15, 7, 42);
    const since = justAddedSince(now);
    expect(since % JUST_ADDED_STEP_MS).toBe(0);
    expect(since).toBeLessThanOrEqual(now - JUST_ADDED_WINDOW_MS);
    expect(since).toBeGreaterThan(now - JUST_ADDED_WINDOW_MS - JUST_ADDED_STEP_MS);
  });

  it("is stable within a step", () => {
    const start = Date.UTC(2026, 10, 18, 15, 5, 0);
    expect(justAddedSince(start)).toBe(justAddedSince(start + JUST_ADDED_STEP_MS - 1));
  });
});

describe("convexSiteUrl", () => {
  it("maps cloud deployments to .convex.site", () => {
    expect(convexSiteUrl("https://happy-otter-123.convex.cloud")).toBe("https://happy-otter-123.convex.site");
  });

  it("uses the next port for a local backend", () => {
    expect(convexSiteUrl("http://127.0.0.1:3210")).toBe("http://127.0.0.1:3211");
  });
});
