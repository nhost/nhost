import type { FormControlLabelProps } from '@/components/ui/v2/FormControlLabel';
import {
  FormControlLabel,
  formControlLabelClasses,
} from '@/components/ui/v2/FormControlLabel';
import { SvgIcon } from '@/components/ui/v2/icons/SvgIcon';
import { styled } from '@mui/material';
import type { RadioProps as MaterialRadioProps } from '@mui/material/Radio';
import MaterialRadio from '@mui/material/Radio';
import type { ForwardedRef, PropsWithoutRef, ReactNode } from 'react';
import { forwardRef } from 'react';

export interface RadioProps extends MaterialRadioProps {
  /**
   * Value of the radio button.
   */
  value?: string;
  /**
   * Label to be displayed next to the radio button.
   */
  label?: ReactNode;
  /**
   * Props to be passed to individual component slots.
   */
  slotProps?: {
    /**
     * Props to be passed to the radio button.
     */
    radio?: Partial<MaterialRadioProps>;
    /**
     * Props to be passed to the form control label.
     */
    formControl?: Partial<PropsWithoutRef<FormControlLabelProps>>;
  };
}

const StyledFormControlLabel = styled(FormControlLabel)(({ theme }) => ({
  [`& .${formControlLabelClasses.label}`]: {
    display: 'inline-block',
    marginLeft: theme.spacing(1),
    fontSize: theme.typography.pxToRem(15),
    fontWeight: 500,
    lineHeight: theme.typography.pxToRem(22),
  },
}));

const StyledRadio = styled(MaterialRadio)(({ theme }) => ({
  padding: 0,
  width: 18,
  height: 18,
  color: theme.palette.action.disabled,
  [`& > svg`]: {
    width: 18,
    height: 18,
  },
}));

function Radio(
  { label, value, slotProps, ...props }: RadioProps,
  ref: ForwardedRef<HTMLInputElement>,
) {
  return (
    <StyledFormControlLabel
      {...(slotProps?.formControl || {})}
      label={label}
      value={value}
      control={
        <StyledRadio
          checkedIcon={
            <SvgIcon
              width={18}
              height={18}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 18 18"
            >
              <circle cx="9" cy="9" r="4" fill="currentColor" />
              <rect
                x=".75"
                y=".75"
                width="16.5"
                height="16.5"
                rx="8.25"
                stroke="currentColor"
                fill="none"
                strokeWidth="1.5"
              />
            </SvgIcon>
          }
          icon={
            <SvgIcon
              width={18}
              height={18}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 18 18"
            >
              <rect
                x=".75"
                y=".75"
                width="16.5"
                height="16.5"
                rx="8.25"
                stroke="currentColor"
                fill="none"
                strokeWidth="1.5"
              />
            </SvgIcon>
          }
          disableRipple
          ref={ref}
          {...slotProps?.radio}
          {...props}
        />
      }
    />
  );
}

Radio.displayName = 'NhostRadio';

export default forwardRef(Radio);
