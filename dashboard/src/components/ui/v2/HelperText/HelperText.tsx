import { styled } from '@mui/material';
import type { FormHelperTextProps as MaterialFormHelperTextProps } from '@mui/material/FormHelperText';
import MaterialFormHelperText from '@mui/material/FormHelperText';
import type { ElementType } from 'react';

export interface HelperTextProps extends MaterialFormHelperTextProps {
  /**
   * Custom component for the root node.
   */
  component?: ElementType;
}

const HelperText = styled(MaterialFormHelperText)<HelperTextProps>({
  fontSize: 12,
  lineHeight: '1.125rem',
  margin: 0,
  minHeight: '1.125rem',
});

HelperText.displayName = 'NativeHelperText';

export default HelperText;
