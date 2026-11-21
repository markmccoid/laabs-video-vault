import { describe, expect, it } from "vitest";
import { emptySelection, pruneSelection, selectAll, selectClick, selectOnly, selectStep } from "./selection";

const order = ["a", "b", "c", "d", "e"];

describe("selectClick", () => {
  it("selects only the clicked item", () => {
    expect(selectClick(selectOnly("a"), "c", {}, order)).toEqual({ ids: ["c"], anchor: "c", cursor: "c" });
  });

  it("toggles with ⌘, keeping list order", () => {
    const one = selectClick(selectOnly("d"), "b", { toggle: true }, order);
    expect(one.ids).toEqual(["b", "d"]);
    expect(selectClick(one, "d", { toggle: true }, order).ids).toEqual(["b"]);
  });

  it("selects a range from the anchor with ⇧, in either direction", () => {
    expect(selectClick(selectOnly("b"), "d", { range: true }, order).ids).toEqual(["b", "c", "d"]);
    const back = selectClick(selectOnly("d"), "a", { range: true }, order);
    expect(back).toEqual({ ids: ["a", "b", "c", "d"], anchor: "d", cursor: "a" });
  });

  it("re-ranges from the same anchor on a second ⇧-click", () => {
    const first = selectClick(selectOnly("c"), "e", { range: true }, order);
    expect(selectClick(first, "a", { range: true }, order).ids).toEqual(["a", "b", "c"]);
  });

  it("treats ⇧-click with no anchor as a plain click", () => {
    expect(selectClick(emptySelection(), "c", { range: true }, order).ids).toEqual(["c"]);
  });
});

describe("selectStep", () => {
  it("starts at the top going down and the bottom going up", () => {
    expect(selectStep(emptySelection(), 1, false, order).ids).toEqual(["a"]);
    expect(selectStep(emptySelection(), -1, false, order).ids).toEqual(["e"]);
  });

  it("moves one item and stops at the ends", () => {
    expect(selectStep(selectOnly("b"), 1, false, order).ids).toEqual(["c"]);
    expect(selectStep(selectOnly("a"), -1, false, order).ids).toEqual(["a"]);
  });

  it("extends from the anchor with ⇧ and shrinks back", () => {
    const two = selectStep(selectStep(selectOnly("b"), 1, true, order), 1, true, order);
    expect(two.ids).toEqual(["b", "c", "d"]);
    expect(selectStep(two, -1, true, order).ids).toEqual(["b", "c"]);
  });

  it("collapses a multi-selection on a plain arrow", () => {
    const all = selectAll(selectOnly("b"), order);
    expect(selectStep(all, 1, false, order).ids).toEqual(["c"]);
  });

  it("selects nothing in an empty list", () => {
    expect(selectStep(selectOnly("a"), 1, false, [])).toEqual(emptySelection());
  });
});

describe("selectAll", () => {
  it("selects every item", () => {
    expect(selectAll(emptySelection(), order).ids).toEqual(order);
  });
});

describe("pruneSelection", () => {
  it("drops items that left the list and moves the cursor", () => {
    const sel = { ids: ["b", "c"], anchor: "b", cursor: "c" };
    expect(pruneSelection(sel, ["a", "b", "d"])).toEqual({ ids: ["b"], anchor: "b", cursor: "b" });
  });

  it("returns the same object when nothing changed", () => {
    const sel = selectOnly("b");
    expect(pruneSelection(sel, order)).toBe(sel);
  });

  it("empties when nothing is left", () => {
    expect(pruneSelection(selectOnly("z"), order)).toEqual(emptySelection());
  });
});
