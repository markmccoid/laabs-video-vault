import { describe, expect, it } from "vitest";
import { fuzzyRank, fuzzyScore } from "./fuzzy";

describe("fuzzyScore", () => {
  it("matches characters in order, ignoring case", () => {
    expect(fuzzyScore("mtt", "Move to Trash")).not.toBeNull();
    expect(fuzzyScore("TRASH", "Move to Trash")).not.toBeNull();
    expect(fuzzyScore("ttm", "Move to Trash")).toBeNull();
    expect(fuzzyScore("xyz", "Inbox")).toBeNull();
  });

  it("treats an empty query as matching everything", () => {
    expect(fuzzyScore("", "Inbox")).toBe(0);
    expect(fuzzyScore("  ", "Inbox")).toBe(0);
  });

  it("ignores spaces in the query", () => {
    expect(fuzzyScore("move trash", "Move to Trash")).not.toBeNull();
  });

  it("scores word starts above letters inside words", () => {
    expect(fuzzyScore("ad", "Add Video")!).toBeGreaterThan(fuzzyScore("ad", "Shadow")!);
  });
});

describe("fuzzyRank", () => {
  const items = ["Find", "Inbox", "Mark This Moment", "Move to Folder…", "Move to Trash"];

  it("puts a prefix match first", () => {
    expect(fuzzyRank("inb", items, (s) => s)[0]).toBe("Inbox");
  });

  it("ranks word-start matches above scattered ones", () => {
    expect(fuzzyRank("mt", ["Smartest", "Move to Trash"], (s) => s)).toEqual(["Move to Trash", "Smartest"]);
  });

  it("drops items that don't match", () => {
    expect(fuzzyRank("trash", items, (s) => s)).toEqual(["Move to Trash"]);
  });

  it("keeps the original order for an empty query", () => {
    expect(fuzzyRank("", items, (s) => s)).toEqual(items);
  });
});
