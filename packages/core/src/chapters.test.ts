import { describe, expect, it } from "vitest";
import { parseChapters } from "./chapters";

describe("parseChapters", () => {
  it("parses a standard chapter list", () => {
    const desc = `Great video about joinery.

0:00 Intro
1:23 - Layout
(4:05) Cutting the tails
1:02:10 Glue up

Links: https://example.com`;
    expect(parseChapters(desc)).toEqual([
      { seconds: 0, label: "Intro" },
      { seconds: 83, label: "Layout" },
      { seconds: 245, label: "Cutting the tails" },
      { seconds: 3730, label: "Glue up" },
    ]);
  });

  it("supports trailing timestamps", () => {
    expect(parseChapters("Intro 0:00\nMiddle 2:00\nEnd 5:00")).toEqual([
      { seconds: 0, label: "Intro" },
      { seconds: 120, label: "Middle" },
      { seconds: 300, label: "End" },
    ]);
  });

  it("requires a 0:00 start", () => {
    expect(parseChapters("0:10 A\n1:00 B\n2:00 C")).toEqual([]);
  });

  it("requires at least three chapters", () => {
    expect(parseChapters("0:00 A\n1:00 B")).toEqual([]);
  });

  it("requires ascending order", () => {
    expect(parseChapters("0:00 A\n3:00 B\n2:00 C")).toEqual([]);
  });

  it("returns [] for descriptions without chapters", () => {
    expect(parseChapters("Just a description.\nNo timestamps here.")).toEqual([]);
  });
});
