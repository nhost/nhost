import type { FormControlProps } from '@/ui/v2/FormControl';
import FormControl from '@/ui/v2/FormControl';
import PopperUnstyled from '@mui/base/PopperUnstyled';
import type { SelectUnstyledProps } from '@mui/base/SelectUnstyled';
import SelectUnstyled from '@mui/base/SelectUnstyled';
import { styled } from '@mui/material';
import clsx from 'clsx';
import type { ForwardedRef, PropsWithoutRef } from 'react';
import { forwardRef } from 'react';
import type { ToggleButtonProps } from './ToggleButton';
import ToggleButton from './ToggleButton';

export interface SelectProps<TValue extends {}>
  extends SelectUnstyledProps<TValue>,
    Pick<
      FormControlProps,
      | 'fullWidth'
      | 'label'
      | 'helperText'
      | 'hideEmptyHelperText'
      | 'error'
      | 'variant'
      | 'inlineInputProportion'
    > {
  /**
   * Props for component slots.
   */
  slotProps?: SelectUnstyledProps<TValue>['slotProps'] & {
    root?: Partial<PropsWithoutRef<ToggleButtonProps>>;
    label?: Partial<FormControlProps['labelProps']>;
    formControl?: Partial<FormControlProps>;
  };
  /**
   * Class name for the form control component.
   */
  className?: string;
}

const StyledListbox = styled('ul')(({ theme }) => ({
  boxShadow: `0px 1px 4px rgba(14, 24, 39, 0.1), 0px 8px 24px rgba(14, 24, 39, 0.1)`,
  borderRadius: theme.shape.borderRadius,
  overflow: 'auto',
  minWidth: 320,
  maxWidth: 500,
  maxHeight: 400,
  margin: theme.spacing(1.25, 0),
  backgroundColor:
    theme.palette.mode === 'dark'
      ? theme.palette.secondary[100]
      : theme.palette.common.white,
  border:
    theme.palette.mode === 'dark'
      ? `1px solid ${theme.palette.grey[300]}`
      : 'none',
  borderWidth: theme.palette.mode === 'dark' ? 1 : 0,
  borderColor: theme.palette.mode === 'dark' ? 'grey.400' : 'none',
  '&:focus': {
    outline: 'none',
  },
}));

const StyledPopper = styled(PopperUnstyled)`
  z-index: 10;
`;

function Select<TValue>(
  {
    className,
    slotProps,
    children,
    fullWidth,
    placeholder,
    label,
    helperText,
    hideEmptyHelperText,
    inlineInputProportion,
    error,
    variant,
    ...props
  }: SelectProps<TValue>,
  ref: ForwardedRef<HTMLButtonElement>,
) {
  const slots: SelectUnstyledProps<TValue>['slots'] = {
    root: ToggleButton,
    popper: StyledPopper,
    listbox: StyledListbox,
    ...props.slots,
  };

  return (
    <FormControl
      fullWidth={fullWidth}
      label={label}
      helperText={helperText}
      hideEmptyHelperText={hideEmptyHelperText}
      error={error}
      variant={variant}
      className={clsx(
        slotProps?.formControl?.className,
        error && 'error',
        className,
      )}
      inlineInputProportion={inlineInputProportion}
      {...slotProps?.formControl}
      labelProps={{
        ...slotProps?.label,
        htmlFor: props.id,
      }}
    >
      <SelectUnstyled
        aria-label={typeof label === 'string' ? label : undefined}
        {...props}
        className={clsx(error && 'error')}
        ref={ref}
        slots={slots}
        slotProps={{
          ...slotProps,
          root: {
            ...slotProps?.root,
            placeholder,
          },
          listbox: {
            ...slotProps?.listbox,
            onKeyDown: (event) => {
              // Do not propagate the keydown event if it was for closing the menu
              if (event.key === 'Escape') {
                event.stopPropagation();
              }
            },
          },
        }}
        placeholder={placeholder}
      >
        {children}
      </SelectUnstyled>
    </FormControl>
  );
}

Select.displayName = 'NhostSelect';

export default forwardRef(Select);
