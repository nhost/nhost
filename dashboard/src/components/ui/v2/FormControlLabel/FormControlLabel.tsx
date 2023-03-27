import { styled } from '@mui/material';
import type { FormControlLabelProps as MaterialFormControlLabelProps } from '@mui/material/FormControlLabel';
import MaterialFormControlLabel, {
  formControlLabelClasses,
} from '@mui/material/FormControlLabel';
import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';

export interface FormControlLabelProps extends MaterialFormControlLabelProps {}

const StyledFormControlLabel = styled(MaterialFormControlLabel)(
  ({ theme }) => ({
    margin: 0,
    [`& .${formControlLabelClasses.label}`]: {
      fontSize: '0.75rem',
      lineHeight: '1rem',
      fontWeight: 600,
      color: theme.palette.text.primary,
    },
  }),
);

function FormControlLabel(
  props: FormControlLabelProps,
  ref: ForwardedRef<HTMLElement>,
) {
  return <StyledFormControlLabel ref={ref} {...props} />;
}

FormControlLabel.displayName = 'NhostFormControlLabel';

export { formControlLabelClasses } from '@mui/material/FormControlLabel';
export default forwardRef(FormControlLabel);
