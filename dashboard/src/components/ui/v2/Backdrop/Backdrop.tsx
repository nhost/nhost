import { alpha, styled } from '@mui/material';
import type { BackdropProps as MaterialBackdropProps } from '@mui/material/Backdrop';
import MaterialBackdrop from '@mui/material/Backdrop';

export interface BackdropProps extends MaterialBackdropProps {}

const Backdrop = styled(MaterialBackdrop)(({ theme }) => ({
  backgroundColor:
    theme.palette.mode === 'dark'
      ? alpha(theme.palette.common.black, 0.5)
      : alpha(theme.palette.grey[400], 0.3),
}));

Backdrop.displayName = 'NhostBackdrop';

export default Backdrop;
