import { describe, expect, it } from "vitest";
import {
  appendNoteStamp,
  folderTone,
  highlight,
  matchesScope,
  parseNoteStamps,
  snippet,
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

describe("notes", () => {
  it("splits out timestamp stamps", () => {
    expect(parseNoteStamps("[3:40] Pull pan\n[1:02:03] done")).toEqual([
      { text: "[3:40]", seconds: 220 },
      { text: " Pull pan\n" },
      { text: "[1:02:03]", seconds: 3723 },
      { text: " done" },
    ]);
  });
  it("leaves plain text alone", () => {
    expect(parseNoteStamps("no stamps [here]")).toEqual([{ text: "no stamps [here]" }]);
  });
  it("appends a stamp on a new line", () => {
    expect(appendNoteStamp("", 65)).toBe("[1:05] ");
    expect(appendNoteStamp("hi", 5)).toBe("hi\n[0:05] ");
    expect(appendNoteStamp("hi\n", 5)).toBe("hi\n[0:05] ");
  });
  it("counts words", () => {
    expect(wordCount("  one two\nthree ")).toBe(3);
    expect(wordCount("")).toBe(0);
  });
});

describe("search matching", () => {
  const video = { title: "Cacio e pepe", description: "Starchy pasta water", tagNames: ["italian", "quick"] };
  it("respects scope", () => {
    expect(matchesScope(video, "PASTA", "all")).toBe(true);
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
