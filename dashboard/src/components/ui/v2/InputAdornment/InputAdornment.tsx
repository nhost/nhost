import type { InputAdornmentProps as MaterialInputAdornmentProps } from '@mui/material/InputAdornment';
import MaterialInputAdornment from '@mui/material/InputAdornment';

export interface InputAdornmentProps
  extends Omit<MaterialInputAdornmentProps, 'position'> {
  /**
   * Position of the input adornment.
   * @default 'end'
   */
  position?: 'start' | 'end';
}

function InputAdornment({ children, ...props }: InputAdornmentProps) {
  return (
    <MaterialInputAdornment position="end" {...props}>
      {children}
    </MaterialInputAdornment>
  );
}

InputAdornment.displayName = 'NhostInputAdornment';

export default InputAdornment;
