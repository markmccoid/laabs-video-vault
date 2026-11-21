import { describe, expect, it } from "vitest";
import {
  folderTone,
  highlight,
  matchesScope,
  snippet,
  timestampLabel,
  timestampSeconds,
  wordCount,
} from "./shelf";

const folders = [
  { _id: "cook", depth: 0, order: 0, name: "Cooking" },
  { _id: "pasta", parentId: "cook", depth: 1, order: 0, name: "Pasta" },
  { _id: "week", parentId: "pasta", depth: 2, order: 0, name: "Weeknight" },
  { _id: "wood", depth: 0, order: 1, name: "Woodworking" },
  { _id: "learn", depth: 0, order: 2, name: "Learning" },
  { _id: "music", depth: 0, order: 3, name: "Music", color: "sage" },
];

describe("folderTone", () => {
  it("cycles accent, sage, neutral by top-level position", () => {
    expect(folderTone(folders, "cook")).toBe("accent");
    expect(folderTone(folders, "wood")).toBe("sage");
    expect(folderTone(folders, "learn")).toBe("neutral");
  });
  it("inherits the top-level ancestor's tone", () => {
    expect(folderTone(folders, "week")).toBe("accent");
  });
  it("prefers a saved tone", () => {
    expect(folderTone(folders, "music")).toBe("sage");
  });
  it("falls back to neutral for unknown folders", () => {
    expect(folderTone(folders, "nope")).toBe("neutral");
  });
});

describe("timestamps", () => {
  it("tidies the description", () => {
    expect(timestampLabel("  Fold   the\n dough ", 220)).toBe("Fold the dough");
  });
  it("falls back to the time when empty", () => {
    expect(timestampLabel("   ", 220)).toBe("3:40");
  });
  it("caps the length", () => {
    expect(timestampLabel("x".repeat(200), 0)).toHaveLength(120);
  });
  it("floors positions to whole seconds", () => {
    expect(timestampSeconds(65.9)).toBe(65);
    expect(timestampSeconds(-3)).toBe(0);
    expect(timestampSeconds(Number.NaN)).toBe(0);
  });
});

describe("notes", () => {
  it("counts words", () => {
    expect(wordCount("  one two\nthree ")).toBe(3);
    expect(wordCount("")).toBe(0);
  });
});

describe("search matching", () => {
  const video = { title: "Cacio e pepe", description: "Starchy pasta water", tagNames: ["italian", "quick"] };
  it("respects scope", () => {
    expect(matchesScope(video, "PASTA", "all")).toBe(true);
    expect(matchesScope(video, "only-in-notes", "all")).toBe(true);
    expect(matchesScope(video, "pasta", "title")).toBe(false);
    expect(matchesScope(video, "pasta", "description")).toBe(true);
    expect(matchesScope(video, "ital", "tags")).toBe(true);
    expect(matchesScope(video, "", "title")).toBe(true);
  });
  it("highlights every match", () => {
    expect(highlight("Pepe pepper", "pe")).toEqual([
      { text: "Pe", match: true },
      { text: "pe", match: true },
      { text: " ", match: false },
      { text: "pe", match: true },
      { text: "p", match: false },
      { text: "pe", match: true },
      { text: "r", match: false },
    ]);
  });
  it("makes a snippet around the match", () => {
    expect(snippet("aaaa bbbb target cccc dddd", "target", 5)).toBe("…bbbb target cccc…");
    expect(snippet("nothing", "x")).toBeNull();
  });
});
