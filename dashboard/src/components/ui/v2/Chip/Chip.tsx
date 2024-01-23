import { styled } from '@mui/material';
import type { ChipProps as MaterialChipProps } from '@mui/material/Chip';
import MaterialChip, {
  chipClasses,
  getChipUtilityClass,
} from '@mui/material/Chip';
import type { ElementType } from 'react';

export interface ChipProps extends MaterialChipProps {
  /**
   * Custom component for the root node.
   */
  component?: ElementType;
}

const Chip = styled(MaterialChip)<ChipProps>(({ theme }) => ({
  fontFamily: theme.typography.fontFamily,
  fontSize: theme.typography.pxToRem(12),
  lineHeight: theme.typography.pxToRem(16),
  fontWeight: 500,
  borderRadius: '9999px',
  padding: theme.spacing(0, 0.25),
  [`&.${chipClasses.filledSecondary}`]: {
    backgroundColor: theme.palette.text.secondary,
    color: theme.palette.common.white,
  },
  [`&.${chipClasses.outlinedSecondary}`]: {
    border: `1px solid ${theme.palette.text.secondary}`,
    color: theme.palette.text.secondary,
  },
  [`&.${chipClasses.colorInfo}`]: {
    backgroundColor: theme.palette.primary.light,
    color: theme.palette.primary.main,
  },
  [`&.${chipClasses.colorWarning}`]: {
    backgroundColor: theme.palette.warning.light,
    color: theme.palette.warning.main,
  },
  [`&.${chipClasses.colorSuccess}`]: {
    backgroundColor: theme.palette.success.light,
    color:
      theme.palette.mode === 'dark'
        ? theme.palette.success.main
        : theme.palette.success.dark,
  },
  [`& .${getChipUtilityClass('deleteIconColorDefault')}`]: {
    color: theme.palette.text.primary,
  },
}));

Chip.displayName = 'NhostChip';

export default Chip;
