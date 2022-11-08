import { styled } from '@mui/material';
import type { InputLabelProps as MaterialInputLabelProps } from '@mui/material/InputLabel';
import MaterialInputLabel from '@mui/material/InputLabel';

export interface InputLabelProps extends MaterialInputLabelProps {}

const InputLabel = styled(MaterialInputLabel)<InputLabelProps>(({ theme }) => ({
  position: 'relative',
  maxWidth: '100%',
  transform: 'none',
  fontSize: 12,
  lineHeight: '0.875rem',
  fontWeight: 500,
  color: theme.palette.text.primary,
  transition: theme.transitions.create(['color']),
  overflow: 'initial',
  textOverflow: 'initial',
  whiteSpace: 'initial',
  wordBreak: 'break-all',
}));

InputLabel.displayName = 'NhostInputLabel';

export default InputLabel;
