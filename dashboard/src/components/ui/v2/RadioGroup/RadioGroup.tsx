import type { RadioGroupProps as MaterialRadioGroupProps } from '@mui/material/RadioGroup';
import MaterialRadioGroup from '@mui/material/RadioGroup';
import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';

export interface RadioGroupProps extends MaterialRadioGroupProps {}

function RadioGroup(props: RadioGroupProps, ref: ForwardedRef<HTMLDivElement>) {
  return <MaterialRadioGroup ref={ref} {...props} />;
}

RadioGroup.displayName = 'NhostRadioGroup';

export default forwardRef(RadioGroup);
