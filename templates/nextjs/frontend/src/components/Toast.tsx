'use client';

import {
  createContext,
  type ReactNode,
  use,
  useEffect,
  useRef,
  useState,
} from 'react';

type ShowToast = (message: string) => VoidFunction;
type Toast = { id: number; message: string };

const ToastContext = createContext<ShowToast>(() => () => undefined);
const CurrentToast = createContext<Toast | undefined>(undefined);

/** Shows `message` briefly at the foot of the window. */
export function useToast(): ShowToast {
  return use(ToastContext);
}

/**
 * Repeats the toast for screen readers from inside an open modal dialog,
 * which makes the toast itself inert.
 */
export function ToastStatus() {
  const toast = use(CurrentToast);

  return (
    <div role="status" aria-live="polite" className="sr-only">
      {toast ? <span key={toast.id}>{toast.message}</span> : null}
    </div>
  );
}

/**
 * A short line confirming that something worked, for the changes whose result
 * is not otherwise in view: a copied id, or a setting changed in a dialog that
 * has closed.
 */
export default function ToastProvider({ children }: { children: ReactNode }) {
  const count = useRef(0);
  const region = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<Toast | undefined>();

  useEffect(() => {
    region.current?.showPopover?.();
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const el = region.current;
    if (el?.showPopover) {
      el.hidePopover();
      el.showPopover();
    }

    const timer = setTimeout(() => setToast(undefined), 2400);
    return () => clearTimeout(timer);
  }, [toast]);

  const show: ShowToast = (message) => {
    count.current += 1;
    const id = count.current;
    setToast({ id, message });

    return () =>
      setToast((current) => (current?.id === id ? undefined : current));
  };

  return (
    <ToastContext value={show}>
      <CurrentToast value={toast}>{children}</CurrentToast>
      {/* Clear of the footer, which is pinned to the bottom of the window. */}
      <div
        ref={region}
        popover="manual"
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-auto bottom-20 m-0 flex h-auto w-auto max-w-none justify-center overflow-visible border-0 bg-transparent px-4 py-0"
      >
        {toast ? (
          <p
            key={toast.id}
            className="rounded-lg border bg-secondary px-4 py-2.5 text-sm shadow-lg"
          >
            {toast.message}
          </p>
        ) : null}
      </div>
    </ToastContext>
  );
}
