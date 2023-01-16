import { styled } from '@mui/material';

const OptionGroupBase = styled('span')(({ theme }) => ({
  fontSize: '0.75rem',
  lineHeight: '1.375rem',
  fontWeight: 600,
  color: theme.palette.text.disabled,
  backgroundColor: 'transparent',
  padding: theme.spacing(1.25, 1.5, 0.5, 1.5),
  display: 'block',
  cursor: 'default',
}));

OptionGroupBase.displayName = 'NhostOptionGroupBase';

export default OptionGroupBase;
