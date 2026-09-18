import * as React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/v3/alert-dialog';
import { Button, buttonVariants } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import { cn } from '@/lib/utils';

export interface AppDialogAction {
  label: React.ReactNode;
  onClick?: () => void;
  /**
   * 'submit' relies on the surrounding `onSubmit` handler (form dialogs
   * only). Defaults to 'button'.
   */
  type?: 'button' | 'submit';
  disabled?: boolean;
}

export interface AppDialogProps {
  /**
   * 'form' renders on top of `Dialog` (optionally wrapping the body and
   * footer in a native `<form>` when `onSubmit` is provided). 'confirm'
   * renders on top of `AlertDialog`, for destructive/confirmation prompts.
   */
  type: 'form' | 'confirm';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Body content, e.g. form fields. Omit for a plain confirmation. */
  children?: React.ReactNode;
  cancelLabel?: string;
  /**
   * 'confirm' dialogs only: hide the Cancel button, leaving just the
   * primary action. Use for a purely informational confirm dialog where
   * there's nothing to cancel, only to acknowledge. Defaults to showing
   * it, so every existing 'confirm' usage is unaffected.
   */
  showCancel?: boolean;
  /** Extra side effect on cancel (e.g. resetting a form), run before close. */
  onCancel?: () => void;
  /**
   * Form dialogs only: omit this to skip AppDialog's own footer entirely,
   * when `children` already renders its own footer/buttons (e.g. a
   * multi-step dialog body). Required for the 'confirm' type.
   */
  primaryAction?: AppDialogAction;
  /** Renders the primary action as the destructive button style. */
  destructive?: boolean;
  /** Form dialogs only: wraps body + footer in `<form onSubmit={onSubmit}>`. */
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
  contentClassName?: string;
  /**
   * Form dialogs only: when true, closing the dialog (Escape, overlay
   * click, the built-in X button, or the Cancel button) first asks the
   * user to confirm discarding unsaved changes instead of closing right
   * away.
   */
  isDirty?: boolean;
}

export function AppDialog({
  type,
  open,
  onOpenChange,
  title,
  description,
  children,
  cancelLabel = 'Cancel',
  showCancel = true,
  onCancel,
  primaryAction,
  destructive,
  onSubmit,
  contentClassName,
  isDirty,
}: AppDialogProps) {
  const [confirmingDiscard, setConfirmingDiscard] = React.useState(false);
  const headerClassName = children ? 'mb-4' : 'mb-12';
  const primaryButtonVariant = destructive ? 'destructive' : 'default';

  if (type === 'confirm') {
    // 'confirm' dialogs always render through AppDialog's own footer, so
    // primaryAction is required for this type even though the prop is
    // optional overall (to support 'form' dialogs with a fully custom body).
    const confirmAction = primaryAction as AppDialogAction;

    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent
          className={cn('gap-0 p-12 text-foreground', contentClassName)}
        >
          <AlertDialogHeader className={headerClassName}>
            <AlertDialogTitle className="text-xl">{title}</AlertDialogTitle>
            {description && (
              <AlertDialogDescription>{description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>

          {children && <div className="mb-4">{children}</div>}

          <AlertDialogFooter>
            {showCancel && (
              <AlertDialogCancel onClick={onCancel}>
                {cancelLabel}
              </AlertDialogCancel>
            )}
            <AlertDialogAction
              onClick={confirmAction.onClick}
              disabled={confirmAction.disabled}
              className={buttonVariants({ variant: primaryButtonVariant })}
            >
              {confirmAction.label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Closing for real: runs the caller's onCancel side effect (e.g.
  // resetting a form), then actually closes.
  const closeForReal = () => {
    onCancel?.();
    onOpenChange(false);
  };

  // Any attempt to close (Cancel button, Escape, overlay click, the X
  // button) goes through here first. If the form is dirty, it opens the
  // discard confirmation instead of closing immediately.
  const requestClose = () => {
    if (isDirty) {
      setConfirmingDiscard(true);
      return;
    }
    closeForReal();
  };

  // Escape / overlay click / the X button all fire the Radix root's
  // onOpenChange(false) directly, so it needs the same dirty guard as the
  // Cancel button.
  const handleRootOpenChange = (next: boolean) => {
    if (!next) {
      requestClose();
      return;
    }
    onOpenChange(next);
  };

  const hasManagedFooter = Boolean(primaryAction);

  const header = (
    <DialogHeader className={headerClassName}>
      <DialogTitle className="text-xl">{title}</DialogTitle>
      {description && <DialogDescription>{description}</DialogDescription>}
    </DialogHeader>
  );

  const body =
    children &&
    (hasManagedFooter ? (
      <div className="mb-12 flex flex-col gap-4">{children}</div>
    ) : (
      children
    ));

  const footer = primaryAction && (
    <DialogFooter>
      <Button type="button" variant="outline-emboss" onClick={requestClose}>
        {cancelLabel}
      </Button>
      <Button
        type={primaryAction.type ?? 'button'}
        variant={primaryButtonVariant}
        disabled={primaryAction.disabled}
        onClick={primaryAction.onClick}
      >
        {primaryAction.label}
      </Button>
    </DialogFooter>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={handleRootOpenChange}>
        <DialogContent
          className={cn(
            'gap-0 p-12 text-foreground sm:max-w-xl',
            contentClassName,
          )}
        >
          {onSubmit && hasManagedFooter ? (
            <form onSubmit={onSubmit}>
              {header}
              {body}
              {footer}
            </form>
          ) : (
            <>
              {header}
              {body}
              {footer}
            </>
          )}
        </DialogContent>
      </Dialog>

      {isDirty !== undefined && (
        <AppDialog
          type="confirm"
          open={confirmingDiscard}
          onOpenChange={(next) => {
            if (!next) {
              setConfirmingDiscard(false);
            }
          }}
          title="Unsaved changes"
          description="You have unsaved changes. Are you sure you want to discard them?"
          destructive
          primaryAction={{
            label: 'Discard',
            onClick: () => {
              setConfirmingDiscard(false);
              closeForReal();
            },
          }}
        />
      )}
    </>
  );
}
