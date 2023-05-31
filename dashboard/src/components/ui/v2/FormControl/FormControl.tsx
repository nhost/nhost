import type { HelperTextProps } from '@/components/ui/v2/HelperText';
import { HelperText } from '@/components/ui/v2/HelperText';
import type { InputLabelProps } from '@/components/ui/v2/InputLabel';
import { InputLabel } from '@/components/ui/v2/InputLabel';
import { styled } from '@mui/material';
import type { BoxProps } from '@mui/material/Box';
import Box from '@mui/material/Box';
import type { FormControlProps as MaterialFormControlProps } from '@mui/material/FormControl';
import MaterialFormControl from '@mui/material/FormControl';
import type { ReactNode } from 'react';

export interface FormControlProps
  extends Omit<MaterialFormControlProps, 'variant'> {
  /**
   * Variant of the input field.
   *
   * @default 'normal'
   */
  variant?: 'normal' | 'inline';
  /**
   * Proportion of the input field.
   *
   * @default '75%'
   */
  inlineInputProportion?: '50%' | '66%' | '75%' | '100%';
  /**
   * Label for the input field.
   */
  label?: ReactNode;
  /**
   * Helper text to show below the input field.
   */
  helperText?: ReactNode;
  /**
   * Props passed to the label component.
   */
  labelProps?: InputLabelProps;
  /**
   * Props passed to the input wrapper component.
   */
  inputWrapperProps?: BoxProps;
  /**
   * Props passed to the helper text component.
   */
  helperTextProps?: HelperTextProps;
  /**
   * Determines whether or not the helper text should be hidden if `helperText`
   * is not set. By default it's always in the DOM to prevent a jumpy effect
   * when `helperText` is set dynamically (e.g: when there is an error).
   *
   * @default true
   */
  hideEmptyHelperText?: boolean;
  /**
   * Children to render inside the input field skeleton.
   */
  children?: ReactNode;
}

const StyledFormControl = styled(MaterialFormControl)(
  ({ theme, fullWidth }) => ({
    display: fullWidth ? 'grid' : 'inline-grid',
    alignContent: 'start',
    gridAutoFlow: 'row',
    gap: theme.spacing(0.5),
    '&:focus-within > label': {
      color: theme.palette.primary.main,
    },
  }),
);

function calculateColSpan(
  proportion: FormControlProps['inlineInputProportion'],
  numberOfColumns: number = 8,
) {
  if (proportion === '50%') {
    const colSpan = Math.floor(numberOfColumns * 0.5);

    return {
      label: `span ${colSpan} / span ${colSpan}`,
      input: `span ${colSpan} / span ${colSpan}`,
    };
  }

  if (proportion === '66%') {
    const inputColSpan = Math.floor(numberOfColumns * 0.66);

    return {
      label: `span ${numberOfColumns - inputColSpan} / span ${
        numberOfColumns - inputColSpan
      }`,
      input: `span ${inputColSpan} / span ${inputColSpan}`,
    };
  }

  if (proportion === '75%') {
    const inputColSpan = Math.floor(numberOfColumns * 0.75);

    return {
      label: `span ${numberOfColumns - inputColSpan} / span ${
        numberOfColumns - inputColSpan
      }`,
      input: `span ${inputColSpan} / span ${inputColSpan}`,
    };
  }

  return {
    label: `span ${numberOfColumns} / span ${numberOfColumns}`,
    input: `span ${numberOfColumns} / span ${numberOfColumns}`,
  };
}

function FormControl({
  labelProps: { sx: labelSx, ...labelProps } = {},
  inputWrapperProps: { sx: inputWrapperSx, ...inputWrapperProps } = {},
  helperTextProps: { sx: helperTextSx, ...helperTextProps } = {},
  label,
  helperText,
  variant = 'normal',
  hideEmptyHelperText = true,
  children,
  sx,
  inlineInputProportion = '75%',
  ...props
}: FormControlProps) {
  const { label: labelColSpan, input: inputColSpan } = calculateColSpan(
    inlineInputProportion,
  );

  return (
    <StyledFormControl
      {...props}
      sx={[
        variant === 'inline' && {
          columnGap: (theme) => theme.spacing(2),
          rowGap: (theme) => theme.spacing(1),
          gridTemplateColumns: {
            xs: 'repeat(1, minmax(0, 1fr))',
            sm: 'repeat(8, minmax(0, 1fr))',
          },
          alignItems: 'center',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {label && (
        <InputLabel
          {...labelProps}
          error={props.error}
          title={typeof label === 'string' ? label : undefined}
          shrink
          sx={[
            variant === 'inline' && {
              gridColumn: {
                xs: 'span 1 / span 1',
                sm: labelColSpan,
              },
            },
            ...(Array.isArray(labelSx) ? labelSx : [labelSx]),
          ]}
        >
          {label}
        </InputLabel>
      )}

      <Box
        sx={[
          variant === 'inline' && {
            gridColumn: {
              xs: 'span 1 / span 1',
              sm: inputColSpan,
            },
            width: '100%',
          },
          ...(Array.isArray(inputWrapperSx)
            ? inputWrapperSx
            : [inputWrapperSx]),
        ]}
        {...inputWrapperProps}
      >
        {children}
      </Box>

      {(!hideEmptyHelperText || helperText) && (
        <HelperText
          {...helperTextProps}
          sx={[
            variant === 'inline' && {
              gridColumn: {
                xs: 'span 1 / span 1',
                sm: inputColSpan,
              },
              gridColumnStart: {
                xs: 0,
                sm: inlineInputProportion === '50%' ? 5 : 3,
              },
            },
            ...(Array.isArray(helperTextSx) ? helperTextSx : [helperTextSx]),
          ]}
          error={props.error}
        >
          {helperText}
        </HelperText>
      )}
    </StyledFormControl>
  );
}

FormControl.displayName = 'NhostFormControl';

export default FormControl;
