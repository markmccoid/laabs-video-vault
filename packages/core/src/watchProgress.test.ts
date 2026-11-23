import { describe, expect, it } from "vitest";
import {
  finalSaveDue,
  markSaved,
  newerProgress,
  newViewing,
  periodicSaveDue,
  progressFraction,
  resumeSeconds,
  trackTime,
  type ViewingTracker,
} from "./watchProgress";

/** Play from `from` to `to`, one report a second. */
function play(tracker: ViewingTracker, from: number, to: number): ViewingTracker {
  let tr = tracker;
  for (let t = from; t <= to; t++) tr = trackTime(tr, t);
  return tr;
}

describe("resumeSeconds", () => {
  it("rewinds 3 seconds, never below 0", () => {
    expect(resumeSeconds({ seconds: 120.6 }, false)).toBe(117);
    expect(resumeSeconds({ seconds: 2 }, false)).toBe(0);
  });
  it("starts Shorts and unwatched videos at 0", () => {
    expect(resumeSeconds({ seconds: 40 }, true)).toBe(0);
    expect(resumeSeconds(undefined, false)).toBe(0);
  });
  it("resumes even near the end", () => {
    expect(resumeSeconds({ seconds: 590 }, false)).toBe(587);
  });
});

describe("newerProgress", () => {
  it("keeps the copy saved later", () => {
    const a = { seconds: 10, savedAt: 1 };
    const b = { seconds: 50, savedAt: 2 };
    expect(newerProgress(a, b)).toBe(b);
    expect(newerProgress(b, a)).toBe(b);
    expect(newerProgress(undefined, a)).toBe(a);
    expect(newerProgress(a, undefined)).toBe(a);
  });
});

describe("progressFraction", () => {
  it("uses the progress duration, then the video's", () => {
    expect(progressFraction({ seconds: 30, durationSec: 60 }, 120)).toBe(0.5);
    expect(progressFraction({ seconds: 30 }, 120)).toBe(0.25);
  });
  it("shows nothing without progress or a duration, and caps at 1", () => {
    expect(progressFraction(undefined, 100)).toBeUndefined();
    expect(progressFraction({ seconds: 30 }, undefined)).toBeUndefined();
    expect(progressFraction({ seconds: 130, durationSec: 100 }, undefined)).toBe(1);
  });
});

describe("viewing tracker", () => {
  it("saves nothing until 10 seconds have played", () => {
    let tr = play(newViewing(), 100, 108);
    expect(finalSaveDue(tr)).toBe(false);
    tr = play(tr, 109, 111);
    expect(finalSaveDue(tr)).toBe(true);
  });

  it("doesn't count seeks as watching", () => {
    let tr = trackTime(newViewing(), 0);
    tr = trackTime(tr, 500);
    tr = trackTime(tr, 1500);
    expect(tr.watched).toBe(0);
    expect(finalSaveDue(tr)).toBe(false);
  });

  it("skips a final save when nothing moved since the last one", () => {
    let tr = play(newViewing(), 0, 20);
    tr = markSaved(tr, 1000);
    expect(finalSaveDue(tr)).toBe(false);
    tr = play(tr, 21, 22);
    expect(finalSaveDue(tr)).toBe(true);
  });

  it("saves while playing every 60 seconds once it has moved 15", () => {
    let tr = play(newViewing(), 0, 20);
    expect(periodicSaveDue(tr, 60_000)).toBe(true);
    tr = markSaved(tr, 60_000);
    tr = play(tr, 21, 30);
    expect(periodicSaveDue(tr, 120_000)).toBe(false); // moved only 10s
    tr = play(tr, 31, 40);
    expect(periodicSaveDue(tr, 119_000)).toBe(false); // too soon
    expect(periodicSaveDue(tr, 120_000)).toBe(true);
  });
});
