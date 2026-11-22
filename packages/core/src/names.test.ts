import { describe, expect, it } from "vitest";
import { checkFolderName, checkTagName, MAX_FOLDER_NAME_LENGTH, MAX_TAG_NAME_LENGTH, tagKey } from "./names";

describe("checkFolderName", () => {
  it("trims and collapses whitespace", () => {
    expect(checkFolderName("  Cooking   videos ")).toEqual({ ok: true, name: "Cooking videos" });
  });

  it("rejects empty and too-long names", () => {
    expect(checkFolderName("   ").ok).toBe(false);
    expect(checkFolderName("x".repeat(MAX_FOLDER_NAME_LENGTH)).ok).toBe(true);
    expect(checkFolderName("x".repeat(MAX_FOLDER_NAME_LENGTH + 1)).ok).toBe(false);
  });
});

describe("checkTagName", () => {
  it("drops leading # and lowercases", () => {
    expect(checkTagName("##React Native")).toEqual({ ok: true, name: "react native" });
  });

  it("rejects empty, # inside, and too-long names", () => {
    expect(checkTagName("#").ok).toBe(false);
    expect(checkTagName("a#b").ok).toBe(false);
    expect(checkTagName("x".repeat(MAX_TAG_NAME_LENGTH + 1)).ok).toBe(false);
  });

  it("keys tags case-insensitively", () => {
    expect(tagKey("React")).toBe(tagKey("react"));
  });
});
