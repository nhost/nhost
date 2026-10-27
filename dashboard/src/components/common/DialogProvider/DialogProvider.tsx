import { X } from 'lucide-react';
import { useRouter } from 'next/router';
import type { BaseSyntheticEvent, PropsWithChildren } from 'react';
import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/v3/alert-dialog';
import { Button } from '@/components/ui/v3/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/v3/dialog';
import {
  Sheet,
  SheetContent,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
} from '@/components/ui/v3/sheet';
import { useRestoreFocus } from '@/hooks/useRestoreFocus';
import { cn } from '@/lib/utils';
import type { DialogConfig, OpenDialogOptions } from './DialogContext';
import DialogContext from './DialogContext';
import {
  alertDialogReducer,
  dialogReducer,
  drawerReducer,
} from './dialogReducers';

function isBaseSyntheticEvent(event: unknown): event is BaseSyntheticEvent {
  return (event as BaseSyntheticEvent)?.type !== undefined;
}

const MAX_WIDTH = {
  xs: 'max-w-lg',
  sm: 'max-w-[640px]',
  md: 'max-w-[768px]',
} as const;

function defaultOverflow(className?: string) {
  return className
    ?.split(/\s+/)
    .some((utility) =>
      /(?:^|:)!?overflow(?:-[xy])?-|^!?\[overflow(?:-[xy])?:/.test(utility),
    )
    ? undefined
    : 'overflow-y-auto';
}

function DialogProvider({ children }: PropsWithChildren<unknown>) {
  const router = useRouter();

  const [
    { open: dialogOpen, title: dialogTitle, activeDialog, dialogProps },
    dialogDispatch,
  ] = useReducer(dialogReducer, {
    open: false,
  });

  const [
    {
      open: drawerOpen,
      title: drawerTitle,
      activeDialog: activeDrawer,
      dialogProps: drawerProps,
    },
    drawerDispatch,
  ] = useReducer(drawerReducer, {
    open: false,
  });

  const [
    {
      open: alertDialogOpen,
      dialogProps: alertDialogProps,
      title: alertDialogTitle,
      payload: alertDialogPayload,
    },
    alertDialogDispatch,
  ] = useReducer(alertDialogReducer, {
    open: false,
  });

  const dialogContentRef = useRef<HTMLDivElement>(null);
  const drawerContentRef = useRef<HTMLDivElement>(null);
  const drawerOverlayRef = useRef<HTMLDivElement>(null);
  const alertContentRef = useRef<HTMLDivElement>(null);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const secondaryButtonRef = useRef<HTMLButtonElement>(null);
  const alertFocus = useRestoreFocus();
  const dialogFocus = useRestoreFocus();
  const drawerFocus = useRestoreFocus();
  const isDrawerDirty = useRef(false);
  const isDialogDirty = useRef(false);
  const dirtySourcesRef = useRef<
    Map<string, { dirty: boolean; location: 'drawer' | 'dialog' }>
  >(new Map());
  const [showDirtyConfirmation, setShowDirtyConfirmation] = useState(false);

  const hasAnyDirtySource = useCallback((location: 'drawer' | 'dialog') => {
    for (const entry of dirtySourcesRef.current.values()) {
      if (entry.location === location && entry.dirty) {
        return true;
      }
    }
    return false;
  }, []);

  const clearDirtySources = useCallback((location: 'drawer' | 'dialog') => {
    for (const [id, entry] of dirtySourcesRef.current) {
      if (entry.location === location) {
        dirtySourcesRef.current.delete(id);
      }
    }
  }, []);

  const setDirtySource = useCallback(
    (
      id: string,
      isDirty: boolean,
      location: 'drawer' | 'dialog' = 'drawer',
    ) => {
      const existing = dirtySourcesRef.current.get(id);
      if (
        existing &&
        existing.dirty === isDirty &&
        existing.location === location
      ) {
        return;
      }
      dirtySourcesRef.current.set(id, { dirty: isDirty, location });
    },
    [],
  );

  const { rememberFocus: rememberDialogFocus } = dialogFocus;
  const openDialog = useCallback(
    (options: OpenDialogOptions) => {
      // Before render: content with autoFocus makes Radix skip onOpenAutoFocus.
      rememberDialogFocus();
      dialogDispatch({ type: 'OPEN_DIALOG', payload: options });
    },
    [rememberDialogFocus],
  );

  const closeDialog = useCallback(() => {
    dialogDispatch({ type: 'HIDE_DIALOG' });
    isDialogDirty.current = false;
    clearDirtySources('dialog');
  }, [clearDirtySources]);

  const { rememberFocus: rememberDrawerFocus } = drawerFocus;
  const openDrawer = useCallback(
    (options: OpenDialogOptions) => {
      rememberDrawerFocus();
      drawerDispatch({ type: 'OPEN_DRAWER', payload: options });
    },
    [rememberDrawerFocus],
  );

  const closeDrawer = useCallback(() => {
    drawerDispatch({ type: 'HIDE_DRAWER' });
    isDrawerDirty.current = false;
    clearDirtySources('drawer');
  }, [clearDirtySources]);

  function openAlertDialog<TConfig = string>(config: DialogConfig<TConfig>) {
    alertFocus.rememberFocus();
    alertDialogDispatch({ type: 'OPEN_ALERT', payload: config });
  }

  function closeAlertDialog() {
    alertDialogDispatch({ type: 'HIDE_ALERT' });
    setShowDirtyConfirmation(false);
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: openAlertDialog does the same every render
  const openDirtyConfirmation = useCallback(
    (config?: Partial<DialogConfig<string>>) => {
      const { props, ...restConfig } = config || {};

      setShowDirtyConfirmation(true);
      openAlertDialog({
        ...config,
        title: 'Unsaved changes',
        payload:
          'You have unsaved local changes. Are you sure you want to discard them?',
        props: {
          ...props,
          primaryButtonText: 'Discard',
          primaryButtonColor: 'error',
        },
        ...restConfig,
      });
    },
    [],
  );

  const closeDrawerWithDirtyGuard = useCallback(
    (event?: unknown) => {
      if (
        (isDrawerDirty.current || hasAnyDirtySource('drawer')) &&
        isBaseSyntheticEvent(event) &&
        event.type !== 'submit'
      ) {
        setShowDirtyConfirmation(true);
        openDirtyConfirmation({ props: { onPrimaryAction: closeDrawer } });
        return;
      }

      closeDrawer();
    },
    [closeDrawer, hasAnyDirtySource, openDirtyConfirmation],
  );

  const closeDialogWithDirtyGuard = useCallback(
    (event?: unknown) => {
      if (
        (isDialogDirty.current || hasAnyDirtySource('dialog')) &&
        isBaseSyntheticEvent(event) &&
        event.type !== 'submit'
      ) {
        setShowDirtyConfirmation(true);
        openDirtyConfirmation({ props: { onPrimaryAction: closeDialog } });
        return;
      }

      closeDialog();
    },
    [closeDialog, hasAnyDirtySource, openDirtyConfirmation],
  );

  const onDirtyStateChange = useCallback(
    (dirty: boolean, location: 'drawer' | 'dialog' = 'drawer') => {
      if (location === 'dialog') {
        isDialogDirty.current = dirty;

        return;
      }

      if (location === 'drawer') {
        isDrawerDirty.current = dirty;
      }
    },
    [],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: openAlertDialog and closeAlertDialog does the same thing every render
  const contextValue = useMemo(
    () => ({
      openDialog,
      openDrawer,
      openAlertDialog,
      closeDialog,
      closeDrawer,
      closeDialogWithDirtyGuard,
      closeDrawerWithDirtyGuard,
      closeAlertDialog,
      setDirtySource,
      onDirtyStateChange,
      openDirtyConfirmation,
    }),
    [
      closeDialog,
      closeDialogWithDirtyGuard,
      closeDrawer,
      closeDrawerWithDirtyGuard,
      setDirtySource,
      onDirtyStateChange,
      openDialog,
      openDirtyConfirmation,
      openDrawer,
    ],
  );

  useEffect(() => {
    function handleCloseDrawerAndDialog() {
      if (
        isDrawerDirty.current ||
        isDialogDirty.current ||
        hasAnyDirtySource('drawer') ||
        hasAnyDirtySource('dialog')
      ) {
        openDirtyConfirmation({
          props: {
            onPrimaryAction: () => {
              closeDialog();
              closeDrawer();
            },
          },
        });

        throw new Error('Unsaved changes');
      }

      closeDrawer();
      closeDialog();
    }

    router?.events?.on?.('routeChangeStart', handleCloseDrawerAndDialog);

    return () => {
      router?.events?.off?.('routeChangeStart', handleCloseDrawerAndDialog);
    };
  }, [
    closeDialog,
    closeDrawer,
    hasAnyDirtySource,
    openDirtyConfirmation,
    router.events,
  ]);

  return (
    <DialogContext.Provider value={contextValue}>
      <AlertDialog
        open={!!(alertDialogOpen || showDirtyConfirmation)}
        onOpenChange={(open) => !open && closeAlertDialog()}
      >
        <AlertDialogContent
          ref={alertContentRef}
          className={cn(
            'max-h-[calc(100dvh-4rem)] max-w-lg gap-0 p-12',
            defaultOverflow(alertDialogProps?.PaperProps?.className),
            MAX_WIDTH[alertDialogProps?.maxWidth ?? 'xs'],
            alertDialogProps?.PaperProps?.className,
          )}
          onOpenAutoFocus={(event) => {
            // Radix otherwise focuses AlertDialogCancel, which this provider does not render.
            event.preventDefault();
            const content = alertContentRef.current;
            (
              primaryButtonRef.current ??
              secondaryButtonRef.current ??
              content?.querySelector<HTMLElement>(
                'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
              ) ??
              content
            )?.focus();
          }}
          onCloseAutoFocus={(event) => {
            alertFocus.restoreFocus(event);
            // Presence keeps the content mounted through exit; a reopen during exit cancels this callback.
            alertDialogProps?.TransitionProps?.onExited?.();
          }}
        >
          <AlertDialogTitle
            className={cn(
              'pb-2 font-semibold text-xl',
              (alertDialogProps?.hideTitle || !alertDialogTitle) && 'sr-only',
              alertDialogProps?.titleProps?.className,
            )}
          >
            {alertDialogTitle}
          </AlertDialogTitle>
          <AlertDialogDescription
            asChild
            className="text-muted-foreground text-sm"
          >
            <div
              className={cn(
                (!alertDialogProps?.hidePrimaryAction ||
                  !alertDialogProps?.hideSecondaryAction) &&
                  'pb-12',
              )}
            >
              {alertDialogPayload}
            </div>
          </AlertDialogDescription>
          {(!alertDialogProps?.hidePrimaryAction ||
            !alertDialogProps?.hideSecondaryAction) && (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {!alertDialogProps?.hideSecondaryAction && (
                <Button
                  ref={secondaryButtonRef}
                  className="w-full sm:w-auto"
                  variant="outline"
                  onClick={() => {
                    alertDialogProps?.onSecondaryAction?.();
                    closeAlertDialog();
                  }}
                >
                  {alertDialogProps?.secondaryButtonText ?? 'Cancel'}
                </Button>
              )}
              {!alertDialogProps?.hidePrimaryAction && (
                <Button
                  ref={primaryButtonRef}
                  className="w-full sm:w-auto"
                  variant={
                    alertDialogProps?.primaryButtonColor === 'error'
                      ? 'destructive'
                      : 'default'
                  }
                  onClick={() => {
                    alertDialogProps?.onPrimaryAction?.();
                    closeAlertDialog();
                  }}
                >
                  {alertDialogProps?.primaryButtonText ?? 'Confirm'}
                </Button>
              )}
            </div>
          )}
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!dialogOpen}
        onOpenChange={(open) => {
          // No DialogClose can bind to this provider-owned root; fallback for future consumers.
          if (!open) {
            closeDialog();
          }
        }}
      >
        <DialogContent
          ref={dialogContentRef}
          tabIndex={-1}
          hideCloseButton
          aria-describedby={undefined}
          className={cn(
            'flex max-h-[calc(100dvh-4rem)] w-full max-w-xl flex-col gap-0 p-0',
            defaultOverflow(dialogProps?.PaperProps?.className),
            dialogProps?.PaperProps?.className,
          )}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            dialogContentRef.current?.focus();
          }}
          onCloseAutoFocus={dialogFocus.restoreFocus}
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            closeDialogWithDirtyGuard(event);
          }}
          onPointerDownOutside={(event) => {
            event.preventDefault();
            if (
              event.detail.originalEvent.target ===
              dialogContentRef.current?.parentElement
            ) {
              closeDialogWithDirtyGuard(event);
            }
          }}
          // A nested portal (including the alert) must not dismiss the underlying dialog.
          onFocusOutside={(event) => event.preventDefault()}
        >
          {dialogTitle && !dialogProps?.hideTitle ? (
            <div
              className={cn(
                'grid grid-flow-col items-center justify-between px-12 pt-12 pb-4',
                dialogProps?.titleProps?.className,
              )}
            >
              <DialogTitle className="font-semibold text-xl leading-7 tracking-normal">
                {dialogTitle}
              </DialogTitle>
              {dialogProps?.titleProps?.onClose && (
                <Button
                  variant="subtle"
                  size="icon"
                  aria-label="Close"
                  onClick={dialogProps.titleProps.onClose}
                >
                  <X className="h-5 w-5" />
                </Button>
              )}
            </div>
          ) : (
            <DialogTitle className="sr-only">{dialogTitle}</DialogTitle>
          )}
          <RetryableErrorBoundary
            errorMessageProps={{ className: 'pt-0 pb-12 px-12' }}
          >
            {isValidElement(activeDialog)
              ? cloneElement(activeDialog, {
                  ...activeDialog.props,
                  location: 'dialog',
                  // biome-ignore lint/suspicious/noExplicitAny: TODO
                  onSubmit: async (values?: any) => {
                    await activeDialog?.props?.onSubmit?.(values);
                    closeDialog();
                  },
                  onCancel: (event?: unknown) => {
                    activeDialog?.props?.onCancel?.(event);
                    closeDialogWithDirtyGuard(event);
                  },
                })
              : null}
          </RetryableErrorBoundary>
        </DialogContent>
      </Dialog>

      <Sheet
        open={!!drawerOpen}
        onOpenChange={(open) => {
          // No SheetClose can bind to this provider-owned root; fallback for future consumers.
          if (!open) {
            closeDrawer();
          }
        }}
      >
        <SheetPortal>
          <SheetOverlay
            ref={drawerOverlayRef}
            className="z-40 bg-black/30 backdrop-blur-sm"
          />
        </SheetPortal>
        <SheetContent
          ref={drawerContentRef}
          side="right"
          showOverlay={false}
          hideCloseButton
          tabIndex={-1}
          aria-describedby={undefined}
          className={cn(
            'z-40 flex h-full w-full max-w-4xl flex-col gap-0 p-0 data-[state=open]:duration-300 sm:max-w-4xl',
            defaultOverflow(drawerProps?.PaperProps?.className),
            drawerProps?.PaperProps?.className,
          )}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            drawerContentRef.current?.focus();
          }}
          onCloseAutoFocus={drawerFocus.restoreFocus}
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            closeDrawerWithDirtyGuard(event);
          }}
          onPointerDownOutside={(event) => {
            event.preventDefault();
            if (
              event.detail.originalEvent.target === drawerOverlayRef.current
            ) {
              closeDrawerWithDirtyGuard(event);
            }
          }}
          // A nested portal or a dialog/alert above the drawer must not dismiss it.
          onFocusOutside={(event) => event.preventDefault()}
        >
          <div
            className={cn(
              'grid grid-flow-col items-center justify-between px-6 py-5',
              drawerProps?.titleProps?.className,
            )}
          >
            <SheetTitle className="font-medium text-lg leading-7">
              {drawerTitle}
            </SheetTitle>
            <Button
              variant="subtle"
              size="icon"
              aria-label="Close"
              onClick={closeDrawerWithDirtyGuard}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <RetryableErrorBoundary>
            {isValidElement(activeDrawer)
              ? cloneElement(activeDrawer, {
                  ...activeDrawer.props,
                  location: 'drawer',
                  // biome-ignore lint/suspicious/noExplicitAny: TODO
                  onSubmit: async (values?: any) => {
                    await activeDrawer?.props?.onSubmit?.(values);
                    closeDrawer();
                  },
                  onCancel: (event?: unknown) => {
                    activeDrawer?.props?.onCancel?.(event);
                    closeDrawerWithDirtyGuard(event);
                  },
                })
              : null}
          </RetryableErrorBoundary>
        </SheetContent>
      </Sheet>

      {children}
    </DialogContext.Provider>
  );
}

DialogProvider.displayName = 'NhostDialogProvider';

export default DialogProvider;
