import { styled } from '@mui/material';
import type { BadgeProps as MaterialBadgeProps } from '@mui/material/Badge';
import MaterialBadge, {
  badgeClasses,
  getBadgeUtilityClass,
} from '@mui/material/Badge';
import { maxWidth, minWidth } from '@mui/system';
import type { ElementType } from 'react';

export interface BadgeProps extends MaterialBadgeProps {
  /**
   * Custom component for the root node.
   */
  component?: ElementType;
}

const Badge = styled(MaterialBadge)<BadgeProps>(({ theme }) => ({
  fontFamily: theme.typography.fontFamily,
  fontSize: theme.typography.pxToRem(12),
  lineHeight: theme.typography.pxToRem(16),
  fontWeight: 500,
  padding: 0,
  // padding: theme.spacing(0, 0.25),
  // '& .MuiTouchRipple-root': {
  //   display: 'none',
  // },
  // [`&.${badgeClasses.colorInfo}`]: {
  //   backgroundColor: theme.palette.primary.light,
  //   color: theme.palette.primary.main,
  // },
  // [`&.${badgeClasses.colorWarning}`]: {
  //   backgroundColor: theme.palette.warning.light,
  //   color: theme.palette.warning.main,
  // },
  // [`&.${badgeClasses.colorSuccess}`]: {
  //   backgroundColor: theme.palette.success.dark,
  //   color:
  //     theme.palette.mode === 'dark'
  //       ? theme.palette.success.dark
  //       : theme.palette.success.dark,
  // },

  '& .MuiBadge-dot': {
    minWidth: '0.75rem',
    minHeight: '0.75rem',
    borderRadius: '50%',
  },
  '& .MuiBadge-standard': {
    padding: 0,
    margin: 0,
    width: '0.5rem',
    maxWidth: '0.5rem',
    minWidth: '0.5rem',
    height: '0.5rem',
    aspectRatio: 'auto 1 / 1',
    borderRadius: '50%',
  },
  '& .MuiBadge-colorError': {
    backgroundColor: theme.palette.error.main,
  },
  '& .MuiBadge-colorWarning': {
    backgroundColor: theme.palette.warning.main,
  },
  '& .MuiBadge-colorSuccess': {
    backgroundColor: theme.palette.success.dark,
  },
    // [`& .${getBadgeUtilityClass('deleteIconColorDefault')}`]: {
  //   color: theme.palette.text.primary,
  // },
}));

Badge.displayName = 'NhostBadge';

export default Badge;
