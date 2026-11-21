import { Check } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useCommand } from "./Commands";
import { Icon } from "./Icon";

type ToastData = { id: number; message: string; undo?: () => unknown };
type Show = (message: string, undo?: ToastData["undo"]) => void;

const ToastContext = createContext<Show>(() => {});
export const useToast = () => useContext(ToastContext);

/**
 * The Shelf toast: a dark pill with a check and an Undo, hiding after four
 * seconds. Edit › Undo (⌘Z outside a text field) runs the newest Undo even
 * after its toast has gone; in a text field it undoes typing as usual.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const next = useRef(0);
  const lastUndo = useRef<{ id: number; undo: () => unknown } | null>(null);

  const show = useCallback<Show>((message, undo) => {
    window.clearTimeout(timer.current);
    const id = ++next.current;
    if (undo) lastUndo.current = { id, undo };
    setToast({ id, message, undo });
    timer.current = window.setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 4000);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const undoLast = () => {
    const last = lastUndo.current;
    if (!last) return;
    lastUndo.current = null;
    setToast((t) => (t?.id === last.id ? null : t));
    void last.undo();
  };

  // execCommand is deprecated but still the only way to reach a field's own
  // undo from the native menu; ⌘Z typed in a field never comes here.
  useCommand("undo", ({ typing }) => (typing ? document.execCommand("undo") : undoLast()));
  useCommand("redo", ({ typing }) => typing && document.execCommand("redo"));

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div className="toast" key={toast.id}>
            <Icon as={Check} size={16} />
            <span>{toast.message}</span>
            {toast.undo && (
              <button
                className="toast-undo"
                onClick={() => {
                  const undo = toast.undo;
                  if (lastUndo.current?.id === toast.id) lastUndo.current = null;
                  setToast(null);
                  void undo?.();
                }}
              >
                Undo
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
