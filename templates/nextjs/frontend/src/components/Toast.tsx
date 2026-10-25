'use client';

import {
  createContext,
  type ReactNode,
  use,
  useEffect,
  useRef,
  useState,
} from 'react';

const ToastContext = createContext<(message: string) => void>(() => undefined);

/** Shows `message` briefly at the foot of the window. */
export function useToast(): (message: string) => void {
  return use(ToastContext);
}

/**
 * A short line confirming that something worked, for the changes whose
 * result is not otherwise in view: a copied id, or a setting changed in a
 * dialog that has closed.
 *
 * One at a time; a second replaces the first rather than stacking. The region
 * is in the page from the start and polite, which is what gets a screen
 * reader to read each message once without cutting anything off.
 */
export default function ToastProvider({ children }: { children: ReactNode }) {
  const count = useRef(0);
  const [toast, setToast] = useState<
    { id: number; message: string } | undefined
  >();

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = setTimeout(() => setToast(undefined), 2400);
    return () => clearTimeout(timer);
  }, [toast]);

  const show = (message: string): void => {
    count.current += 1;
    setToast({ id: count.current, message });
  };

  return (
    <ToastContext value={show}>
      {children}
      {/* Clear of the footer, which is pinned to the bottom of the window. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4"
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
