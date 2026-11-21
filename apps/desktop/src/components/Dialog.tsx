import { useEffect, useRef, type ReactNode } from "react";

/**
 * The Organic dialog (a sheet on Mac): title, body, actions with the primary
 * last. Focus moves in and returns on close; Escape cancels.
 */
export function Dialog({
  title,
  children,
  actions,
  onClose,
  onSubmit,
}: {
  title: string;
  children: ReactNode;
  actions: ReactNode;
  onClose: () => void;
  onSubmit?: () => void;
}) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>("input, select, textarea, button");
    first?.focus();
    return () => previous?.focus();
  }, []);

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        ref={ref}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit?.();
        }}
      >
        <div className="dialog-title" id="dialog-title">
          {title}
        </div>
        <div className="dialog-body">{children}</div>
        <div className="dialog-actions">{actions}</div>
      </form>
    </div>
  );
}
