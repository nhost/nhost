import { styled } from '@mui/material';
import type { BadgeProps as MaterialBadgeProps } from '@mui/material/Badge';
import MaterialBadge from '@mui/material/Badge';
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
  '& .MuiBadge-dot': {
    minWidth: '0.75rem',
    minHeight: '0.75rem',
    borderRadius: '50%',
  },
  '& .MuiBadge-standard': {
    padding: 0,
    margin: 0,
    width: '0.75rem',
    maxWidth: '0.75rem',
    minWidth: '0.75rem',
    height: '0.75rem',
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
}));

Badge.displayName = 'NhostBadge';

export default Badge;
