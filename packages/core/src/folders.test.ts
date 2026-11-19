import { describe, expect, it } from "vitest";
import {
  buildFolderTree,
  canCreateFolderUnder,
  canMoveFolder,
  descendantIds,
  flattenFolderTree,
  folderPath,
  MAX_FOLDER_DEPTH,
} from "./folders";

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

  it("allows creating folders down to the depth limit", () => {
    expect(canCreateFolderUnder(undefined)).toEqual({ ok: true, newDepth: 0 });
    expect(canCreateFolderUnder({ depth: 1 })).toEqual({ ok: true, newDepth: 2 });
    expect(canCreateFolderUnder({ depth: 2 }).ok).toBe(false);
  });

  it("builds a breadcrumb path", () => {
    expect(folderPath(folders, "c")).toEqual(["A", "B", "C"]);
    expect(folderPath(folders, "missing")).toEqual([]);
  });

  it("flattens a tree depth-first", () => {
    expect(flattenFolderTree(buildFolderTree(folders)).map((f) => f._id)).toEqual(["a", "b", "c", "d"]);
  });
});
