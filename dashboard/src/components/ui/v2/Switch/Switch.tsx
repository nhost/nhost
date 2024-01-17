import type { FormControlLabelProps } from '@/components/ui/v2/FormControlLabel';
import { FormControlLabel } from '@/components/ui/v2/FormControlLabel';
import {
  Switch as BaseSwitch,
  switchClasses as baseSwitchClasses,
} from '@mui/base';
import type { SwitchProps as BaseSwitchProps } from '@mui/base/Switch';
import { styled } from '@mui/material';
import type { ForwardedRef, PropsWithoutRef } from 'react';
import { forwardRef } from 'react';

export interface SwitchProps extends BaseSwitchProps {
  /**
   * Label to be displayed next to the checkbox.
   */
  label?: FormControlLabelProps['label'];
  /**
   * Props to be passed to the internal components.
   */
  slotProps?: BaseSwitchProps['slotProps'] & {
    /**
     * Props to be passed to the `Switch` component.
     */
    root?: Partial<BaseSwitchProps>;
    /**
     * Props to be passed to the `FormControlLabel` component.
     */
    formControlLabel?: Partial<PropsWithoutRef<FormControlLabelProps>>;
  };
}

const StyledFormControlLabel = styled(FormControlLabel)(({ theme }) => ({
  display: 'grid',
  gridAutoFlow: 'column',
  gap: theme.spacing(1.25),
  justifyContent: 'start',
}));

const StyledSwitch = styled(BaseSwitch)(({ theme }) => ({
  position: 'relative',
  display: 'inline-block',
  width: '40px',
  height: '24px',
  cursor: 'pointer',

  [`&.${baseSwitchClasses.disabled}`]: {
    cursor: 'not-allowed',

    [`& .${baseSwitchClasses.track}`]: {
      backgroundColor: theme.palette.grey[200],
      color: theme.palette.grey[200],
    },
  },

  [`& .${baseSwitchClasses.track}`]: {
    backgroundColor:
      theme.palette.mode === 'dark'
        ? theme.palette.grey[500]
        : theme.palette.grey[600],
    borderRadius: '16px',
    display: 'block',
    height: '100%',
    width: '100%',
    position: 'absolute',
  },

  [` & .${baseSwitchClasses.thumb}`]: {
    display: 'block',
    width: '18px',
    height: '18px',
    top: '3px',
    left: '3px',
    borderRadius: '16px',
    backgroundColor: theme.palette.common.white,
    position: 'relative',
    transitionProperty: 'all',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '120ms',
  },

  [`&.${baseSwitchClasses.focusVisible} .${baseSwitchClasses.thumb}`]: {
    backgroundColor: theme.palette.action.focus,
    boxShadow: '0 0 1px 8px rgba(0, 0, 0, 0.25)',
  },

  [`&.${baseSwitchClasses.checked}`]: {
    [`.${baseSwitchClasses.thumb}`]: {
      left: '19px',
      top: '3px',
      backgroundColor: theme.palette.common.white,
    },

    [`.${baseSwitchClasses.track}`]: {
      backgroundColor: theme.palette.primary.main,
    },

    [`&.${baseSwitchClasses.disabled}`]: {
      [`.${baseSwitchClasses.track}`]: {
        opacity: 0.5,
        backgroundColor:
          theme.palette.mode === 'dark'
            ? theme.palette.grey[500]
            : theme.palette.grey[600],
      },
    },
  },

  [`& .${baseSwitchClasses.input}`]: {
    cursor: 'inherit',
    position: 'absolute',
    width: '100%',
    height: '100%',
    top: '0',
    left: '0',
    opacity: '0',
    zIndex: '1',
    margin: '0',
  },
}));

function Switch(
  { label, slotProps, ...props }: SwitchProps,
  ref: ForwardedRef<HTMLSpanElement>,
) {
  if (!label) {
    return <StyledSwitch {...(slotProps?.root || {})} {...props} ref={ref} />;
  }

  return (
    <StyledFormControlLabel
      {...(slotProps?.formControlLabel || {})}
      control={
        <StyledSwitch {...(slotProps?.root || {})} {...props} ref={ref} />
      }
      label={label}
    />
  );
}

Switch.displayName = 'NhostSwitch';

export default forwardRef(Switch);
