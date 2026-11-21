import { Check } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

type ToastData = { id: number; message: string; undo?: () => unknown };
type Show = (message: string, undo?: ToastData["undo"]) => void;

const ToastContext = createContext<Show>(() => {});
export const useToast = () => useContext(ToastContext);

/** The Shelf toast: a dark pill with a check and an Undo, hiding after four seconds. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const next = useRef(0);

  const show = useCallback<Show>((message, undo) => {
    window.clearTimeout(timer.current);
    const id = ++next.current;
    setToast({ id, message, undo });
    timer.current = window.setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 4000);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

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
