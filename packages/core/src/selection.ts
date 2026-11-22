/**
 * Finder-style selection in a list. `ids` is kept in list order. `anchor` is
 * where a ⇧ range starts; `cursor` is the item the arrow keys move from.
 */
export type ListSelection<T> = { ids: T[]; anchor: T | null; cursor: T | null };

export const emptySelection = <T>(): ListSelection<T> => ({ ids: [], anchor: null, cursor: null });

const inOrder = <T>(ids: Iterable<T>, order: readonly T[]): T[] => {
  const want = new Set(ids);
  return order.filter((id) => want.has(id));
};

const between = <T>(a: T, b: T, order: readonly T[]): T[] => {
  const i = order.indexOf(a);
  const j = order.indexOf(b);
  if (i < 0 || j < 0) return j < 0 ? [] : [b];
  return order.slice(Math.min(i, j), Math.max(i, j) + 1);
};

/** Just this item. */
export const selectOnly = <T>(id: T): ListSelection<T> => ({ ids: [id], anchor: id, cursor: id });

/**
 * A click: plain selects only this item, ⌘ (toggle) adds or removes it, and
 * ⇧ (range) selects everything from the anchor to it.
 */
export function selectClick<T>(
  sel: ListSelection<T>,
  id: T,
  mods: { toggle?: boolean; range?: boolean },
  order: readonly T[],
): ListSelection<T> {
  if (mods.range && sel.anchor !== null && order.includes(sel.anchor)) {
    return { ids: between(sel.anchor, id, order), anchor: sel.anchor, cursor: id };
  }
  if (mods.toggle) {
    const has = sel.ids.includes(id);
    const ids = has ? sel.ids.filter((x) => x !== id) : inOrder([...sel.ids, id], order);
    return { ids, anchor: id, cursor: id };
  }
  return selectOnly(id);
}

/** ↑/↓ (dir -1/1): move to the next item, or with ⇧ (extend) grow the range from the anchor. */
export function selectStep<T>(sel: ListSelection<T>, dir: 1 | -1, extend: boolean, order: readonly T[]): ListSelection<T> {
  if (order.length === 0) return emptySelection();
  const at = sel.cursor === null ? -1 : order.indexOf(sel.cursor);
  const next =
    at < 0 ? order[dir === 1 ? 0 : order.length - 1]! : order[Math.min(Math.max(at + dir, 0), order.length - 1)]!;
  if (extend && sel.anchor !== null && order.includes(sel.anchor)) {
    return { ids: between(sel.anchor, next, order), anchor: sel.anchor, cursor: next };
  }
  return selectOnly(next);
}

/** Every item; the anchor stays put so a later ⇧-click still starts from it. */
export function selectAll<T>(sel: ListSelection<T>, order: readonly T[]): ListSelection<T> {
  if (order.length === 0) return emptySelection();
  return { ids: [...order], anchor: sel.anchor ?? order[0]!, cursor: sel.cursor ?? order[0]! };
}

/** Drop items no longer in the list. Returns the same object when nothing changed. */
export function pruneSelection<T>(sel: ListSelection<T>, order: readonly T[]): ListSelection<T> {
  const ids = inOrder(sel.ids, order);
  const anchor = sel.anchor !== null && order.includes(sel.anchor) ? sel.anchor : (ids[0] ?? null);
  const cursor = sel.cursor !== null && order.includes(sel.cursor) ? sel.cursor : (ids.at(-1) ?? null);
  if (ids.length === sel.ids.length && ids.every((id, i) => id === sel.ids[i]) && anchor === sel.anchor && cursor === sel.cursor) {
    return sel;
  }
  return ids.length ? { ids, anchor, cursor } : emptySelection();
}
