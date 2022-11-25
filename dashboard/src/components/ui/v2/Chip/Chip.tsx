import { styled } from '@mui/material';
import type { ChipProps as MaterialChipProps } from '@mui/material/Chip';
import MaterialChip, { chipClasses } from '@mui/material/Chip';
import type { ElementType } from 'react';

export interface ChipProps extends MaterialChipProps {
  /**
   * Custom component for the root node.
   */
  component?: string | ElementType;
}

const Chip = styled(MaterialChip)<ChipProps>(({ theme }) => ({
  fontFamily: theme.typography.fontFamily,
  fontSize: theme.typography.pxToRem(12),
  lineHeight: theme.typography.pxToRem(16),
  fontWeight: 500,
  borderRadius: '9999px',
  padding: theme.spacing(0, 0.25),
  [`&.${chipClasses.colorInfo}`]: {
    backgroundColor: theme.palette.primary.light,
    color: theme.palette.primary.main,
  },
}));

Chip.displayName = 'NhostChip';

export default Chip;
