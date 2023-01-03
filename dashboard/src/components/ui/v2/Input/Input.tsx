import type { FormControlProps } from '@/ui/v2/FormControl';
import FormControl from '@/ui/v2/FormControl';
import { darken, lighten, styled } from '@mui/material';
import type { InputBaseProps as MaterialInputBaseProps } from '@mui/material/InputBase';
import MaterialInputBase, { inputBaseClasses } from '@mui/material/InputBase';
import type { DetailedHTMLProps, ForwardedRef, HTMLProps } from 'react';
import { forwardRef } from 'react';
import mergeRefs from 'react-merge-refs';

export interface InputProps
  extends Omit<MaterialInputBaseProps, 'componentsProps' | 'slotProps'>,
    Pick<
      FormControlProps,
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
  slotProps?: {
    /**
     * Props passed to MUI's `<Input />` component.
     */
    input?: Partial<MaterialInputBaseProps>;
    /**
     * Props passed to the `<Box />` component wrapping the input.
     */
    inputWrapper?: Partial<FormControlProps['inputWrapperProps']>;
    /**
     * Props passed to the native `<input />` element.
     */
    inputRoot?: Partial<
      DetailedHTMLProps<HTMLProps<HTMLInputElement>, HTMLInputElement>
    >;
    /**
     * Props passed to the label in the `<FormControl />` component.
     */
    label?: Partial<FormControlProps['labelProps']>;
    /**
     * Props passed to the `<FormControl />` component.
     */
    formControl?: Partial<FormControlProps>;
    /**
     * Props passed to the helper text in the `<FormControl />` component.
     */
    helperText?: Partial<FormControlProps['helperTextProps']>;
  };
}

const StyledInputBase = styled(MaterialInputBase)(({ theme }) => ({
  border: `1px solid ${theme.palette.grey[400]}`,
  borderRadius: theme.shape.borderRadius,
  overflow: 'hidden',
  transition: theme.transitions.create(['border-color', 'box-shadow']),
  [`& .${inputBaseClasses.input}`]: {
    fontSize: theme.typography.pxToRem(15),
    lineHeight: theme.typography.pxToRem(22),
    padding: theme.spacing(1, 1.25),
    color: theme.palette.text.primary,
    outline: 'none',
    backgroundColor: 'transparent',
  },
  [`&.${inputBaseClasses.multiline}`]: {
    padding: 0,
  },
  [`&.${inputBaseClasses.focused}`]: {
    outline: 'none',
  },
  [`&.${inputBaseClasses.disabled}`]: {
    color: `${theme.palette.grey[600]} !important`,
    borderColor: `${darken(theme.palette.grey[300], 0.1)} !important`,
    backgroundColor: `${lighten(
      theme.palette.action.disabled,
      0.75,
    )} !important`,
  },
  [`&:not(.${inputBaseClasses.disabled}):hover`]: {
    borderColor: theme.palette.grey[600],
  },
  [`&.${inputBaseClasses.focused}`]: {
    borderColor: theme.palette.grey[700],
    outline: 'none',
    boxShadow: 'none',
  },
  [`&.${inputBaseClasses.focused} .${inputBaseClasses.input}`]: {
    outline: 'none',
    boxShadow: 'none',
  },
  [`&.${inputBaseClasses.error}`]: {
    borderColor: theme.palette.error.main,
  },
  [`&.${inputBaseClasses.error}:focus`]: {
    borderColor: theme.palette.error.dark,
  },
}));

function Input(
  {
    label,
    helperText,
    hideEmptyHelperText,
    inlineInputProportion,
    variant = 'normal',
    slotProps,
    className,
    'aria-label': ariaLabel,
    ...props
  }: InputProps,
  ref: ForwardedRef<HTMLInputElement>,
) {
  const {
    inputWrapper: inputWrapperSlotProps,
    input: inputSlotProps,
    inputRoot: inputRootSlotProps,
    formControl: { sx: formControlSx, ...formControlSlotProps },
    label: labelSlotProps,
    helperText: helperTextSlotProps,
  } = {
    inputWrapper: slotProps?.inputWrapper || {},
    input: slotProps?.input || {},
    inputRoot: slotProps?.inputRoot || {},
    formControl: slotProps?.formControl || {},
    label: slotProps?.label || {},
    helperText: slotProps?.helperText || {},
  };

  return (
    <FormControl
      sx={[
        { alignItems: props.multiline ? 'start' : 'center' },
        ...(Array.isArray(formControlSx) ? formControlSx : [formControlSx]),
      ]}
      className={className}
      label={label}
      helperText={helperText}
      hideEmptyHelperText={hideEmptyHelperText}
      labelProps={{
        htmlFor: props.id,
        ...formControlSlotProps.labelProps,
        ...labelSlotProps,
      }}
      inputWrapperProps={inputWrapperSlotProps}
      helperTextProps={helperTextSlotProps}
      variant={variant}
      fullWidth={props.fullWidth}
      error={props.error}
      inlineInputProportion={inlineInputProportion}
      {...formControlSlotProps}
    >
      <StyledInputBase
        {...inputSlotProps}
        {...props}
        inputProps={{
          'aria-label': ariaLabel,
          ...props?.inputProps,
          ...inputRootSlotProps,
        }}
        inputRef={mergeRefs([ref, props.inputRef])}
        disabled={props.disabled}
      />
    </FormControl>
  );
}

Input.displayName = 'NhostInput';

export { inputBaseClasses as inputClasses } from '@mui/material/InputBase';

export default forwardRef(Input);
