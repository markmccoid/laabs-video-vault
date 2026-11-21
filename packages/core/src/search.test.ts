import { describe, expect, it } from "vitest";
import { buildSearchText } from "./search";

describe("buildSearchText", () => {
  it("includes timestamp descriptions", () => {
    const text = buildSearchText({
      title: "Bread",
      channelTitle: "Baker",
      description: "",
      notes: "",
      tagNames: ["baking"],
      timestampLabels: ["Shaping the loaf", "Scoring"],
    });
    expect(text).toContain("Shaping the loaf");
    expect(text).toContain("Scoring");
    expect(text).toContain("baking");
  });
});
