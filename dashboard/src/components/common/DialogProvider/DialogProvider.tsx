import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { AlertDialog } from '@/components/ui/v2/AlertDialog';
import { BaseDialog } from '@/components/ui/v2/Dialog';
import { Drawer } from '@/components/ui/v2/Drawer';
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
import { twMerge } from 'tailwind-merge';
import type { DialogConfig, OpenDialogOptions } from './DialogContext';
import DialogContext from './DialogContext';
import {
  alertDialogReducer,
  dialogReducer,
  drawerReducer,
} from './dialogReducers';

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

  const isDrawerDirty = useRef(false);
  const isDialogDirty = useRef(false);
  const [showDirtyConfirmation, setShowDirtyConfirmation] = useState(false);

  const openDialog = useCallback((options: OpenDialogOptions) => {
    dialogDispatch({ type: 'OPEN_DIALOG', payload: options });
  }, []);

  const closeDialog = useCallback(() => {
    dialogDispatch({ type: 'HIDE_DIALOG' });
    isDialogDirty.current = false;
  }, []);

  const clearDialogContent = useCallback(() => {
    dialogDispatch({ type: 'CLEAR_DIALOG_CONTENT' });
  }, []);

  const openDrawer = useCallback((options: OpenDialogOptions) => {
    drawerDispatch({ type: 'OPEN_DRAWER', payload: options });
  }, []);

  const closeDrawer = useCallback(() => {
    drawerDispatch({ type: 'HIDE_DRAWER' });
    isDrawerDirty.current = false;
  }, []);

  const clearDrawerContent = useCallback(() => {
    drawerDispatch({ type: 'CLEAR_DRAWER_CONTENT' });
  }, []);

  function openAlertDialog<TConfig = string>(config?: DialogConfig<TConfig>) {
    alertDialogDispatch({ type: 'OPEN_ALERT', payload: config });
  }

  function closeAlertDialog() {
    alertDialogDispatch({ type: 'HIDE_ALERT' });
    setShowDirtyConfirmation(false);
  }

  function clearAlertDialogContent() {
    alertDialogDispatch({ type: 'CLEAR_ALERT_CONTENT' });
  }

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
    (event?: BaseSyntheticEvent) => {
      if (isDrawerDirty.current && event?.type !== 'submit') {
        setShowDirtyConfirmation(true);
        openDirtyConfirmation({ props: { onPrimaryAction: closeDrawer } });
        return;
      }

      closeDrawer();
    },
    [closeDrawer, openDirtyConfirmation],
  );

  const closeDialogWithDirtyGuard = useCallback(
    (event?: BaseSyntheticEvent) => {
      if (isDialogDirty.current && event?.type !== 'submit') {
        setShowDirtyConfirmation(true);
        openDirtyConfirmation({ props: { onPrimaryAction: closeDialog } });
        return;
      }

      closeDialog();
    },
    [closeDialog, openDirtyConfirmation],
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
      onDirtyStateChange,
      openDirtyConfirmation,
    }),
    [
      closeDialog,
      closeDialogWithDirtyGuard,
      closeDrawer,
      closeDrawerWithDirtyGuard,
      onDirtyStateChange,
      openDialog,
      openDirtyConfirmation,
      openDrawer,
    ],
  );

  useEffect(() => {
    function handleCloseDrawerAndDialog() {
      if (isDrawerDirty.current || isDialogDirty.current) {
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
  }, [closeDialog, closeDrawer, openDirtyConfirmation, router.events]);

  return (
    <DialogContext.Provider value={contextValue}>
      <AlertDialog
        {...alertDialogProps}
        title={alertDialogTitle}
        message={alertDialogPayload}
        hideTitle={alertDialogProps?.hideTitle}
        open={alertDialogOpen || showDirtyConfirmation}
        onClose={closeAlertDialog}
        onSecondaryAction={() => {
          if (alertDialogProps?.onSecondaryAction) {
            alertDialogProps.onSecondaryAction();
          }

          closeAlertDialog();
        }}
        onPrimaryAction={() => {
          if (alertDialogProps?.onPrimaryAction) {
            alertDialogProps.onPrimaryAction();
          }

          closeAlertDialog();
        }}
        TransitionProps={{
          onExited: (node) => {
            if (alertDialogProps?.TransitionProps?.onExited) {
              alertDialogProps.TransitionProps.onExited(node);
            }

            clearAlertDialogContent();
          },
        }}
      />

      <BaseDialog
        {...dialogProps}
        title={dialogTitle}
        open={dialogOpen}
        onClose={closeDialogWithDirtyGuard}
        TransitionProps={{ onExited: clearDialogContent, unmountOnExit: false }}
        PaperProps={{
          ...dialogProps?.PaperProps,
          className: twMerge(
            'max-w-md w-full',
            dialogProps?.PaperProps?.className,
            'z-30',
          ),
        }}
      >
        <RetryableErrorBoundary
          errorMessageProps={{ className: 'pt-0 pb-5 px-6' }}
        >
          {isValidElement(activeDialog)
            ? cloneElement(activeDialog, {
                ...activeDialog.props,
                location: 'dialog',
                onSubmit: async (values?: any) => {
                  await activeDialog?.props?.onSubmit?.(values);
                  closeDialog();
                },
                onCancel: () => {
                  activeDialog?.props?.onCancel?.();
                  closeDialogWithDirtyGuard();
                },
              })
            : null}
        </RetryableErrorBoundary>
      </BaseDialog>

      <Drawer
        anchor="right"
        {...drawerProps}
        title={drawerTitle}
        open={drawerOpen}
        onClose={closeDrawerWithDirtyGuard}
        SlideProps={{ onExited: clearDrawerContent, unmountOnExit: false }}
        className="z-40"
        PaperProps={{
          ...drawerProps?.PaperProps,
          className: twMerge(
            'max-w-4xl w-full',
            drawerProps?.PaperProps?.className,
          ),
        }}
      >
        <RetryableErrorBoundary>
          {isValidElement(activeDrawer)
            ? cloneElement(activeDrawer, {
                ...activeDrawer.props,
                location: 'drawer',
                onSubmit: async (values?: any) => {
                  await activeDrawer?.props?.onSubmit?.(values);
                  closeDrawer();
                },
                onCancel: () => {
                  activeDrawer?.props?.onCancel?.();
                  closeDrawerWithDirtyGuard();
                },
              })
            : null}
        </RetryableErrorBoundary>
      </Drawer>

      {children}
    </DialogContext.Provider>
  );
}

DialogProvider.displayName = 'NhostDialogProvider';

export default DialogProvider;
