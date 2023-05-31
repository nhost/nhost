import { Button } from '@/components/ui/v2/Button';
import type { CommonDialogProps } from '@/components/ui/v2/Dialog';
import { Dialog } from '@/components/ui/v2/Dialog';

export interface AlertDialogProps extends CommonDialogProps {
  /**
   * Determines whether the dialog is open or not.
   */
  open: boolean;
}

function AlertDialog({
  title,
  message,
  titleProps,
  contentProps,
  contentTextProps,
  actionsProps,
  secondaryButtonText = 'Cancel',
  primaryButtonText = 'Confirm',
  onSecondaryAction,
  onPrimaryAction,
  hideTitle,
  hideSecondaryAction,
  hidePrimaryAction,
  primaryButtonColor = 'primary',
  maxWidth = 'xs',
  PaperProps,
  ...props
}: AlertDialogProps) {
  return (
    <Dialog.Root
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      maxWidth={maxWidth}
      PaperProps={{
        ...PaperProps,
        sx: {
          padding: (theme) => theme.spacing(3),
          ...(Array.isArray(PaperProps?.sx) ? PaperProps.sx : [PaperProps?.sx]),
        },
      }}
      {...props}
    >
      {!hideTitle && !!title && (
        <Dialog.Title {...titleProps} id="alert-dialog-title">
          {title}
        </Dialog.Title>
      )}

      <Dialog.Content {...contentProps}>
        {typeof message === 'string' ? (
          <Dialog.ContentText
            {...contentTextProps}
            id="alert-dialog-description"
          >
            {message}
          </Dialog.ContentText>
        ) : (
          message
        )}
      </Dialog.Content>

      {(!hidePrimaryAction || !hideSecondaryAction) && (
        <Dialog.Actions {...actionsProps}>
          {!hidePrimaryAction && (
            // TODO: Manage loading states
            <Button
              variant="contained"
              color={primaryButtonColor}
              autoFocus
              onClick={onPrimaryAction}
            >
              {primaryButtonText}
            </Button>
          )}

          {!hideSecondaryAction && (
            <Button
              variant="outlined"
              color="secondary"
              onClick={onSecondaryAction}
              autoFocus={hidePrimaryAction}
            >
              {secondaryButtonText}
            </Button>
          )}
        </Dialog.Actions>
      )}
    </Dialog.Root>
  );
}

AlertDialog.displayName = 'NhostAlertDialog';

export default AlertDialog;
