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
    minWidth: '0.625rem',
    minHeight: '0.625rem',
    borderRadius: '50%',
  },
  '& .MuiBadge-standard': {
    padding: 0,
    margin: 0,
    minWidth: '0.625rem',
    height: '0.625rem',
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
  '& .MuiBadge-colorSecondary': {
    backgroundColor: theme.palette.grey[500],
  },
}));

Badge.displayName = 'NhostBadge';

export default Badge;
