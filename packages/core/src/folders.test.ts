import { describe, expect, it } from "vitest";
import { buildFolderTree, canMoveFolder, descendantIds, MAX_FOLDER_DEPTH } from "./folders";

// a
// ├─ b
// │  └─ c
// d
const folders = [
  { _id: "a", depth: 0, order: 0, name: "A" },
  { _id: "b", parentId: "a", depth: 1, order: 0, name: "B" },
  { _id: "c", parentId: "b", depth: 2, order: 0, name: "C" },
  { _id: "d", depth: 0, order: 1, name: "D" },
];

describe("folders", () => {
  it("limits nesting to 3 levels", () => {
    expect(MAX_FOLDER_DEPTH).toBe(3);
  });

  it("builds a tree", () => {
    const tree = buildFolderTree(folders);
    expect(tree.map((n) => n._id)).toEqual(["a", "d"]);
    expect(tree[0]!.children[0]!.children[0]!._id).toBe("c");
  });

  it("collects descendants", () => {
    expect(descendantIds(folders, "a").sort()).toEqual(["a", "b", "c"]);
    expect(descendantIds(folders, "d")).toEqual(["d"]);
  });

  it("rejects cycles", () => {
    expect(canMoveFolder(folders, "a", "c").ok).toBe(false);
    expect(canMoveFolder(folders, "a", "a").ok).toBe(false);
  });

  it("rejects moves that exceed the depth limit", () => {
    // b has height 2 (b, c); under d it would span depths 1–2: OK
    expect(canMoveFolder(folders, "b", "d")).toEqual({ ok: true, newDepth: 1 });
    // a has height 3; under d it would need depth 3: too deep
    expect(canMoveFolder(folders, "a", "d").ok).toBe(false);
    // d (leaf) under c would be depth 3: too deep
    expect(canMoveFolder(folders, "d", "c").ok).toBe(false);
  });

  it("allows moving to top level", () => {
    expect(canMoveFolder(folders, "c", undefined)).toEqual({ ok: true, newDepth: 0 });
  });
});
