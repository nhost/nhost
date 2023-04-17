import type { CommonDialogProps } from './DialogRoot';
import DialogRoot from './DialogRoot';
import DialogTitle from './DialogTitle';

export interface DialogProps extends CommonDialogProps {
  /**
   * Determines whether the dialog is open or not.
   */
  open: boolean;
}

function Dialog({
  title,
  children,
  titleProps,
  hideTitle,
  ...props
}: DialogProps) {
  return (
    <DialogRoot
      aria-labelledby="dialog-title"
      aria-describedby="dialog-description"
      {...props}
    >
      {!hideTitle && !!title && (
        <DialogTitle
          sx={{
            padding: (theme) => theme.spacing(3, 3, 1.5, 3),
            ...(Array.isArray(titleProps?.sx)
              ? titleProps.sx
              : [titleProps?.sx]),
          }}
          {...titleProps}
          id="dialog-title"
        >
          {title}
        </DialogTitle>
      )}

      {children}
    </DialogRoot>
  );
}

Dialog.displayName = 'NhostDialog';

export default Dialog;
