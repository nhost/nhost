import { styled } from '@mui/material';
import type { ChipProps as MaterialChipProps } from '@mui/material/Chip';
import MaterialChip from '@mui/material/Chip';

export interface ChipProps extends MaterialChipProps {}

const Chip = styled(MaterialChip)(({ theme }) => ({
  fontFamily: theme.typography.fontFamily,
  fontSize: '0.75rem',
  fontWeight: 500,
  lineHeight: '16px',
  padding: theme.spacing(1.5, 0.25),
  color: theme.palette.text.primary,
  borderRadius: '9999px',
  backgroundColor: '#EAEDF0',
}));

Chip.displayName = 'NhostChip';

export default Chip;
