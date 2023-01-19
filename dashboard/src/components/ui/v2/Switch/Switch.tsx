import type { FormControlLabelProps } from '@/ui/v2/FormControlLabel';
import FormControlLabel from '@/ui/v2/FormControlLabel';
import SwitchUnstyled, {
  switchUnstyledClasses,
} from '@mui/base/SwitchUnstyled';
import type { SwitchUnstyledProps } from '@mui/base/SwitchUnstyled/SwitchUnstyled.types';
import { styled } from '@mui/material';
import type { ForwardedRef, PropsWithoutRef } from 'react';
import { forwardRef } from 'react';

export interface SwitchProps extends SwitchUnstyledProps {
  /**
   * Label to be displayed next to the checkbox.
   */
  label?: FormControlLabelProps['label'];
  /**
   * Props to be passed to the internal components.
   */
  slotProps?: SwitchUnstyledProps['slotProps'] & {
    /**
     * Props to be passed to the `Switch` component.
     */
    root?: Partial<SwitchUnstyledProps>;
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

const StyledSwitch = styled(SwitchUnstyled)(({ theme }) => ({
  position: 'relative',
  display: 'inline-block',
  width: '40px',
  height: '24px',
  cursor: 'pointer',

  [`&.${switchUnstyledClasses.disabled}`]: {
    cursor: 'not-allowed',

    [`& .${switchUnstyledClasses.track}`]: {
      backgroundColor: theme.palette.grey[200],
      color: theme.palette.grey[200],
    },
  },

  [`& .${switchUnstyledClasses.track}`]: {
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

  [` & .${switchUnstyledClasses.thumb}`]: {
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

  [`&.${switchUnstyledClasses.focusVisible} .${switchUnstyledClasses.thumb}`]: {
    backgroundColor: theme.palette.action.focus,
    boxShadow: '0 0 1px 8px rgba(0, 0, 0, 0.25)',
  },

  [`&.${switchUnstyledClasses.checked}`]: {
    [`.${switchUnstyledClasses.thumb}`]: {
      left: '19px',
      top: '3px',
      backgroundColor: theme.palette.common.white,
    },

    [`.${switchUnstyledClasses.track}`]: {
      backgroundColor: theme.palette.primary.main,
    },

    [`&.${switchUnstyledClasses.disabled}`]: {
      [`.${switchUnstyledClasses.track}`]: {
        opacity: 0.5,
        backgroundColor:
          theme.palette.mode === 'dark'
            ? theme.palette.grey[500]
            : theme.palette.grey[600],
      },
    },
  },

  [`& .${switchUnstyledClasses.input}`]: {
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
