import { alpha, styled } from '@mui/material';
import type { BackdropProps as MaterialBackdropProps } from '@mui/material/Backdrop';
import MaterialBackdrop from '@mui/material/Backdrop';

export interface BackdropProps extends MaterialBackdropProps {}

const Backdrop = styled(MaterialBackdrop)(({ theme }) => ({
  backgroundColor:
    theme.palette.mode === 'dark'
      ? alpha(theme.palette.grey[100], 0.75)
      : alpha(theme.palette.grey[800], 0.25),
}));

Backdrop.displayName = 'NhostBackdrop';

export default Backdrop;
