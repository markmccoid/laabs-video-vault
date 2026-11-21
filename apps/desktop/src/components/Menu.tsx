import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type MenuItem =
  | { kind?: "item"; label: string; kbd?: string; danger?: boolean; disabled?: boolean; onSelect: () => void }
  | { kind: "sep" };

/**
 * The Organic context menu at a point. The same items open from right-click
 * and from a "…" button. Arrow keys move, Return picks, Escape closes.
 */
export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const actionable = items.flatMap((it, i) => (it.kind !== "sep" && !it.disabled ? [i] : []));
  const [active, setActive] = useState<number>(-1);

  // Keep the menu inside the window.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      left: Math.min(x, window.innerWidth - r.width - 8),
      top: Math.min(y, window.innerHeight - r.height - 8),
    });
    el.focus();
  }, [x, y]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("blur", onClose);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("blur", onClose);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  const pick = (i: number) => {
    const it = items[i];
    if (!it || it.kind === "sep" || it.disabled) return;
    onClose();
    it.onSelect();
  };

  return (
    <div
      ref={ref}
      className="menu ctx-menu"
      role="menu"
      tabIndex={-1}
      style={pos}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        const at = actionable.indexOf(active);
        if (e.key === "Escape") onClose();
        else if (e.key === "ArrowDown") setActive(actionable[(at + 1) % actionable.length] ?? -1);
        else if (e.key === "ArrowUp") setActive(actionable[(at - 1 + actionable.length) % actionable.length] ?? -1);
        else if (e.key === "Enter") pick(active);
        else return;
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {items.map((it, i) =>
        it.kind === "sep" ? (
          <div key={i} className="menu-sep" role="separator" />
        ) : (
          <div
            key={i}
            role="menuitem"
            className="menu-item"
            aria-disabled={it.disabled || undefined}
            aria-selected={active === i}
            data-danger={it.danger || undefined}
            onMouseEnter={() => setActive(it.disabled ? -1 : i)}
            onMouseLeave={() => setActive(-1)}
            onClick={() => pick(i)}
          >
            {it.label}
            {it.kbd && <span className="kbd">{it.kbd}</span>}
          </div>
        ),
      )}
    </div>
  );
}
