'use client';

import {
  createContext,
  type ReactNode,
  use,
  useEffect,
  useId,
  useRef,
} from 'react';
import { Button } from '@/components/ui/button';

const CloseDialog = createContext<VoidFunction>(() => undefined);

/** Closes the dialog this renders inside, for a form that is done with it. */
export function useCloseDialog(): VoidFunction {
  return use(CloseDialog);
}

/**
 * A modal on the browser's own `<dialog>`.
 *
 * `showModal()` does the work a dialog library would: the page under it goes
 * inert, focus moves in and stays there, and Escape closes it. So there is
 * nothing to add to the dependencies for it, and nothing here to trap focus
 * by hand.
 *
 * The contents only render while it is open, so a form inside starts fresh
 * every time rather than holding whatever was abandoned in it last.
 */
export default function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const pressedBackdrop = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog?.open) {
      dialog?.showModal();
    } else if (!open && dialog?.open) {
      dialog.close();
    }
  }, [open]);

  const close = (): void => onOpenChange(false);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the keyboard's way out is Escape, which the element handles itself
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      // Escape closes the element by itself; this keeps the state in step.
      onClose={close}
      // The contents fill the dialog, so a press that lands on the element
      // itself is on the backdrop. It has to start there too, or selecting
      // text in a field and letting go past the edge would close it.
      onPointerDown={(event) => {
        pressedBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (pressedBackdrop.current && event.target === event.currentTarget) {
          close();
        }
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/60"
    >
      {open ? (
        <div className="flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-1.5">
            <h2 id={titleId} className="font-semibold text-lg leading-tight">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="text-muted-foreground text-sm">
                {description}
              </p>
            ) : null}
          </div>
          <CloseDialog value={close}>{children}</CloseDialog>
        </div>
      ) : null}
    </dialog>
  );
}

/** The buttons at the foot of a dialog, with the one that acts last. */
export function DialogFooter({ children }: { children: ReactNode }) {
  return <div className="flex justify-end gap-2">{children}</div>;
}

/** Closes the dialog without doing anything else. */
export function DialogClose({
  disabled,
  children = 'Cancel',
}: {
  disabled?: boolean;
  children?: ReactNode;
}) {
  const close = useCloseDialog();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={close}
    >
      {children}
    </Button>
  );
}
