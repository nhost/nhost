import { styled } from '@mui/material';

import type { LinearProgressProps as MaterialLinearProgressProps } from '@mui/material/LinearProgress';
import MaterialLinearProgress, {
  linearProgressClasses,
} from '@mui/material/LinearProgress';

export interface LinearProgressProps extends MaterialLinearProgressProps {}

const LinearProgress = styled(MaterialLinearProgress)(({ theme, value }) => ({
  height: 12,
  borderRadius: 1,
  [`&.${linearProgressClasses.colorPrimary}`]: {
    backgroundColor: theme.palette.grey[300],
  },
  [`& .${linearProgressClasses.bar}`]: {
    backgroundColor:
      value >= 100 ? theme.palette.error.dark : theme.palette.primary.main,
  },
}));

LinearProgress.displayName = 'NhostLinearProgress';

export default LinearProgress;
