import { styled } from '@mui/material';
import type { DialogContentTextProps as MaterialDialogContentTextProps } from '@mui/material/DialogContentText';
import MaterialDialogContentText from '@mui/material/DialogContentText';

export interface DialogContentTextProps
  extends MaterialDialogContentTextProps {}

const DialogContentText = styled(MaterialDialogContentText)(({ theme }) => ({
  fontFamily: theme.typography.fontFamily,
  fontSize: '0.9375rem',
  lineHeight: '1.375rem',
  color: theme.palette.text.primary,
}));

DialogContentText.displayName = 'NhostDialogContentText';

export default DialogContentText;
