import { styled } from '@mui/material';
import type { DialogContentProps as MaterialDialogContentProps } from '@mui/material/DialogContent';
import MaterialDialogContent from '@mui/material/DialogContent';

export interface DialogContentProps extends MaterialDialogContentProps {}

const DialogContent = styled(MaterialDialogContent)(({ theme }) => ({
  padding: 0,
  [`&:not(:last-of-type)`]: {
    paddingBottom: theme.spacing(2),
  },
}));

DialogContent.displayName = 'NhostDialogContent';

export default DialogContent;
