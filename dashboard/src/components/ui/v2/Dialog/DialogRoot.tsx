import { Backdrop } from '@/components/ui/v2/Backdrop';
import type { ButtonProps } from '@/components/ui/v2/Button';
import type { DialogTitleProps } from '@/components/ui/v2/Dialog';
import { styled } from '@mui/material';
import type { DialogProps as MaterialDialogProps } from '@mui/material/Dialog';
import MaterialDialog from '@mui/material/Dialog';
import type { DialogActionsProps } from '@mui/material/DialogActions';
import type { DialogContentProps } from '@mui/material/DialogContent';
import type { DialogContentTextProps } from '@mui/material/DialogContentText';
import Paper from '@mui/material/Paper';
import type { ReactNode } from 'react';

export interface DialogRootProps extends MaterialDialogProps {}
export interface CommonDialogProps
  extends Omit<DialogRootProps, 'title' | 'open'> {
  /**
   * The title of the dialog.
   */
  title?: ReactNode;
  /**
   * The message to display in the dialog.
   */
  message?: ReactNode;
  /**
   * Function to be called when the user clicks the cancel button.
   */
  onSecondaryAction?: VoidFunction;
  /**
   * Function to be called when the user clicks the confirm button.
   */
  onPrimaryAction?: VoidFunction;
  /**
   * Props to be passed to the DialogTitle component.
   */
  titleProps?: DialogTitleProps;
  /**
   * Props to be passed to the DialogContent component.
   */
  contentProps?: DialogContentProps;
  /**
   * Props to be passed to the DialogContentText component.
   */
  contentTextProps?: DialogContentTextProps;
  /**
   * Props to be passed to the DialogActions component.
   */
  actionsProps?: DialogActionsProps;
  /**
   * Secondary button text.
   *
   * @default 'Cancel'
   */
  secondaryButtonText?: string;
  /**
   * Primary button text.
   *
   * @default 'Confirm'
   */
  primaryButtonText?: string;
  /**
   * Determines whether the secondary action button is hidden.
   */
  hideSecondaryAction?: boolean;
  /**
   * Determines whether the primary action button is hidden.
   */
  hidePrimaryAction?: boolean;
  /**
   * Determines whether the title should be hidden.
   */
  hideTitle?: boolean;
  /**
   * Color of the primary action button.
   *
   * @default 'primary'
   */
  primaryButtonColor?: ButtonProps['color'];
}

const StyledDialogPaper = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  backgroundImage: 'none',
  borderRadius: 8,
  boxShadow:
    '0px 1px 4px rgba(14, 24, 39, 0.1), 0px 8px 24px rgba(14, 24, 39, 0.1)',
}));

function DialogRoot({ children, ...props }: DialogRootProps) {
  return (
    <MaterialDialog
      components={{ Backdrop }}
      PaperComponent={StyledDialogPaper}
      {...props}
    >
      {children}
    </MaterialDialog>
  );
}

DialogRoot.displayName = 'NhostDialogRoot';

export default DialogRoot;
