import type { FormControlProps } from '@/ui/v2/FormControl';
import FormControl from '@/ui/v2/FormControl';
import ChevronDownIcon from '@/ui/v2/icons/ChevronDownIcon';
import ChevronUpIcon from '@/ui/v2/icons/ChevronUpIcon';
import type { ButtonUnstyledProps } from '@mui/base/ButtonUnstyled';
import ButtonUnstyled from '@mui/base/ButtonUnstyled';
import PopperUnstyled from '@mui/base/PopperUnstyled';
import type { SelectUnstyledProps } from '@mui/base/SelectUnstyled';
import SelectUnstyled, {
  selectUnstyledClasses,
} from '@mui/base/SelectUnstyled';
import { darken, lighten, styled } from '@mui/material';
import clsx from 'clsx';
import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';

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
    label?: Partial<FormControlProps['labelProps']>;
    formControl?: Partial<FormControlProps>;
  };
  /**
   * Class name for the form control component.
   */
  className?: string;
}

const StyledButton = styled(ButtonUnstyled)(({ theme }) => ({
  display: 'grid',
  width: '100%',
  gridAutoFlow: 'column',
  justifyContent: 'space-between',
  gap: theme.spacing(),
  alignItems: 'center',
  fontFamily: theme.typography.fontFamily,
  fontSize: '0.9375rem',
  lineHeight: '1.375rem',
  fontWeight: 400,
  minHeight: '2.5rem',
  textAlign: 'left',
  color: theme.palette.text.primary,
  padding: theme.spacing(1, 1.25),
  transition: theme.transitions.create([
    'background-color',
    'border-color',
    'box-shadow',
  ]),
  border: `1px solid ${theme.palette.grey[400]}`,
  borderRadius: theme.shape.borderRadius,
  [`&:not(.${selectUnstyledClasses.disabled}):hover`]: {
    borderColor: theme.palette.grey[600],
  },
  [`&.${selectUnstyledClasses.disabled}`]: {
    color: theme.palette.grey[600],
    borderColor: darken(theme.palette.grey[300], 0.1),
    backgroundColor: lighten(theme.palette.grey[200], 0.5),
  },
  [`&.${selectUnstyledClasses.focusVisible}, &.${selectUnstyledClasses.expanded}`]:
    {
      outline: 'none',
      borderColor: theme.palette.grey[700],
    },
  [`&.${selectUnstyledClasses.expanded} .expand`]: {
    display: 'none',
  },
  [`&:not(.${selectUnstyledClasses.expanded}) .expand`]: {
    display: 'block',
  },
  [`&.${selectUnstyledClasses.expanded} .expanded`]: {
    display: 'block',
  },
  [`&:not(.${selectUnstyledClasses.expanded}) .expanded`]: {
    display: 'none',
  },
  '&.error': {
    borderColor: theme.palette.error.main,
  },
  [`&.${selectUnstyledClasses.focusVisible}.error`]: {
    borderColor: theme.palette.error.dark,
  },
}));

const StyledButtonLabel = styled('span')`
  display: flex;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledListbox = styled('ul')(({ theme }) => ({
  boxShadow: `0px 1px 4px rgba(14, 24, 39, 0.1), 0px 8px 24px rgba(14, 24, 39, 0.1)`,
  borderRadius: theme.shape.borderRadius,
  overflow: 'auto',
  minWidth: 320,
  maxWidth: 500,
  maxHeight: 400,
  margin: theme.spacing(1.25, 0),
  backgroundColor: theme.palette.common.white,
  '&:focus': {
    outline: 'none',
  },
}));

const StyledPopper = styled(PopperUnstyled)`
  z-index: 10;
`;

const ToggleButton = forwardRef(
  (
    { children, placeholder, ...props }: ButtonUnstyledProps,
    ref: ForwardedRef<HTMLButtonElement>,
  ) => (
    <StyledButton {...props} ref={ref}>
      <StyledButtonLabel>{children || placeholder}</StyledButtonLabel>

      <ChevronDownIcon
        aria-label="Chevron down"
        sx={{ fontSize: '0.75rem' }}
        className="expand"
      />

      <ChevronUpIcon
        aria-label="Chevron up"
        sx={{ fontSize: '0.75rem' }}
        className="expanded"
      />
    </StyledButton>
  ),
);

ToggleButton.displayName = 'NhostToggleButton';

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
