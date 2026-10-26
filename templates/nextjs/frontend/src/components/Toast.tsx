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

const ToastContext = createContext<ShowToast>(() => () => undefined);

/**
 * Shows `message` briefly at the foot of the window. Returns a function that
 * takes it down early, for a toast about something that has gone away, like
 * a key copied from a dialog that has closed. It leaves alone any toast that
 * has replaced it since.
 */
export function useToast(): ShowToast {
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
 *
 * The region is a popover, which puts it in the browser's top layer: a modal
 * `<dialog>` is drawn there too, above anything a z-index can lift, so a toast
 * from inside one (a copied key) would otherwise show behind it. The top layer
 * stacks in the order things were shown, so each toast shows the region again
 * to come out above whatever dialog opened since.
 */
export default function ToastProvider({ children }: { children: ReactNode }) {
  const count = useRef(0);
  const region = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<
    { id: number; message: string } | undefined
  >();

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
      {children}
      {/* Clear of the footer, which is pinned to the bottom of the window.
          The popover's own box (centred, bordered, filled) is undone, so it
          is only the strip the message sits in. */}
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
