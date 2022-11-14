import { styled } from '@mui/material';
import type { DialogActionsProps as MaterialDialogActionsProps } from '@mui/material/DialogActions';
import MaterialDialogActions from '@mui/material/DialogActions';

export interface DialogActionsProps extends MaterialDialogActionsProps {}

const DialogActions = styled(MaterialDialogActions)(({ theme }) => ({
  display: 'grid',
  gap: theme.spacing(1),
  gridAutoFlow: 'row',
  padding: 0,
  justifyContent: 'initial',
  '& > *': {
    width: '100%',
  },
  '& > :not(:first-of-type)': {
    marginLeft: 0,
  },
}));

DialogActions.displayName = 'NhostDialogActions';

export default DialogActions;
