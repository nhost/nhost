import type { FormControlProps } from '@/components/ui/v2/FormControl';
import { FormControl } from '@/components/ui/v2/FormControl';
import { Popper as BasePopper } from '@mui/base/Popper';
import type { SelectProps as BaseSelectProps } from '@mui/base/Select';
import { Select as BaseSelect } from '@mui/base/Select';
import { styled } from '@mui/system';
import clsx from 'clsx';
import type { ForwardedRef, PropsWithoutRef } from 'react';
import { forwardRef } from 'react';
import type { ToggleButtonProps } from './ToggleButton';
import ToggleButton from './ToggleButton';

export interface SelectProps<TValue extends {}>
  extends BaseSelectProps<TValue, false>,
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
  slotProps?: BaseSelectProps<TValue, false>['slotProps'] & {
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
  borderColor: theme.palette.mode === 'dark' ? theme.palette.grey[400] : 'none',
  '&:focus': {
    outline: 'none',
  },
}));

const StyledPopper = styled(BasePopper)`
  z-index: 9999;
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
  const slots: BaseSelectProps<TValue, false>['slots'] = {
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
      <BaseSelect
        aria-label={typeof label === 'string' ? label : undefined}
        {...props}
        className={clsx(error && 'error')}
        ref={ref}
        slots={slots}
        slotProps={{
          ...slotProps,
          root: {
            ...slotProps?.root,
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
      </BaseSelect>
    </FormControl>
  );
}

Select.displayName = 'NhostSelect';

export default forwardRef(Select);
