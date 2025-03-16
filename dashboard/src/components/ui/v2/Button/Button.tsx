import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import type { SxProps, Theme } from '@mui/material';
import { alpha, styled } from '@mui/material';
import type {
  ButtonTypeMap,
  ButtonProps as MaterialButtonProps,
} from '@mui/material/Button';
import MaterialButton, { buttonClasses } from '@mui/material/Button';
import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';

export type ButtonProps<
  D extends React.ElementType = ButtonTypeMap['defaultComponent'],
  P = {},
> = Omit<MaterialButtonProps<D, P>, 'variant'> & {
  /**
   * Variant of the button.
   */
  variant?: 'contained' | 'outlined' | 'borderless';
  /**
   * Determines whether the button should show an activity indicator.
   */
  loading?: boolean;
};

const StyledButton = styled(MaterialButton)(({ theme }) => ({
  fontFamily: theme.typography.fontFamily,
  textTransform: 'none',
  WebkitFontSmoothing: 'antialiased',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'transparent',
  borderRadius: theme.shape.borderRadius,
  fontSize: '0.9375rem',
  lineHeight: '1.375rem',
  fontWeight: 500,
  backgroundColor: 'transparent',
  transition: theme.transitions.create([
    'color',
    'background-color',
    'border-color',
    'box-shadow',
  ]),
  '&:disabled': {
    borderWidth: 1,
  },
  '&:hover': {
    borderWidth: 1,
  },
  '&:focus': {
    boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.3)}`,
  },
  [`& .${buttonClasses.startIcon}`]: {
    margin: theme.spacing(0, 0.75, 0, -0.25),
  },
}));

const BaseButton = forwardRef(
  (
    { sx, ...props }: Omit<ButtonProps, 'variant'>,
    ref: ForwardedRef<HTMLButtonElement>,
  ) => (
    <StyledButton
      disableRipple
      {...props}
      ref={ref}
      sx={[
        props.size === 'small' && {
          padding: (theme) => theme.spacing(0.5, 0.5),
        },
        props.size === 'medium' && {
          padding: (theme) => theme.spacing(0.875, 1),
        },
        props.size === 'large' && {
          padding: (theme) => theme.spacing(1.125, 2),
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    />
  ),
);

BaseButton.displayName = 'NhostBaseButton';

/**
 * A button component that has no borders, just a background color.
 */
const ContainedButton = forwardRef(
  (
    { sx, color, ...props }: Omit<ButtonProps, 'variant'>,
    ref: ForwardedRef<HTMLButtonElement>,
  ) => {
    let styles: SxProps<Theme> = {
      // TODO: Remove this !important once Tailwind CSS's base styles are handled.
      backgroundColor: (theme) => `${theme.palette.primary.main} !important`,
      '&:hover': {
        backgroundColor: 'primary.main',
      },
      '&:active': {
        backgroundColor: 'primary.dark',
      },
    };

    if (color === 'secondary') {
      styles = {
        // TODO: Remove this !important once Tailwind CSS's base styles are handled.
        backgroundColor: (theme) =>
          `${theme.palette.text.secondary} !important`,
        '&:hover': {
          backgroundColor: 'text.secondary',
          boxShadow: (theme) =>
            `0 0 0 2px ${alpha(theme.palette.text.primary, 0.3)}`,
        },
        '&:active': {
          backgroundColor: 'text.primary',
        },
        '&:focus': {
          boxShadow: (theme) =>
            `0 0 0 2px ${alpha(theme.palette.text.primary, 0.3)}`,
        },
        '&:disabled': {
          color: 'grey.600',
          backgroundColor: (theme) => `${theme.palette.grey[200]} !important`,
        },
      };
    }

    if (color === 'error') {
      styles = {
        // TODO: Remove this !important once Tailwind CSS's base styles are handled.
        backgroundColor: (theme) => `${theme.palette.error.main} !important`,
        '&:disabled': {
          color: (theme) => alpha(theme.palette.common.white, 0.6),
        },
        '&:hover': {
          backgroundColor: 'error.main',
          boxShadow: (theme) =>
            `0 0 0 2px ${alpha(theme.palette.error.main, 0.3)}`,
        },
        '&:active': {
          backgroundColor: 'error.dark',
        },
        '&:focus': {
          backgroundColor: 'error.main',
          boxShadow: (theme) =>
            `0 0 0 2px ${alpha(theme.palette.error.main, 0.3)}`,
        },
      };
    }

    return (
      <BaseButton
        {...props}
        ref={ref}
        sx={[
          {
            color: 'common.white',
            '&:hover': {
              boxShadow: (theme) =>
                `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}`,
            },
            '&:disabled': {
              color: (theme) =>
                `${alpha(theme.palette.common.white, 0.4)} !important`,
            },
          },
          styles,
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      />
    );
  },
);

ContainedButton.displayName = 'NhostContainedButton';

/**
 * A button component that has a border and no background color.
 */
const OutlinedButton = forwardRef(
  (
    { sx, color, ...props }: Omit<ButtonProps, 'variant'>,
    ref: ForwardedRef<HTMLButtonElement>,
  ) => {
    let styles: SxProps<Theme> = {
      // TODO: Remove this !important when Tailwind CSS's base styles are handled.
      color: (theme) => `${theme.palette.primary.main} !important`,
      backgroundColor: (theme) =>
        `${alpha(theme.palette.primary.main, 0.05)} !important`,
      borderColor: 'primary.main',
      '&:hover': {
        backgroundColor: 'transparent',
        borderColor: 'primary.dark',
      },
      '&:active': {
        backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.1),
        borderColor: 'primary.dark',
      },
      '&:focus': {
        boxShadow: (theme) =>
          `0 0 0 2px ${alpha(theme.palette.primary.main, 0.3)}`,
      },
    };

    if (color === 'secondary') {
      styles = {
        color: 'text.primary',
        borderColor: 'grey.400',
        '&:hover': {
          backgroundColor: 'grey.300',
          borderColor: 'grey.300',
        },
        '&:active': {
          backgroundColor: 'grey.300',
          borderColor: 'grey.300',
        },
        '&:focus': {
          backgroundColor: 'grey.300',
          borderColor: 'grey.300',
        },
        '&:disabled': {
          color: (theme) => `${theme.palette.text.disabled} !important`,
          borderColor: 'grey.400',
        },
      };
    }

    if (color === 'error') {
      styles = {
        // TODO: Remove this !important when Tailwind CSS's base styles are handled.
        color: (theme) => `${theme.palette.error.main} !important`,
        borderColor: 'error.main',
        '&:hover': {
          backgroundColor: (theme) => alpha(theme.palette.error.main, 0.1),
          color: 'error.dark',
        },
        '&:active': {
          backgroundColor: (theme) => alpha(theme.palette.error.main, 0.2),
          color: 'error.dark',
        },
        '&:focus': {
          boxShadow: (theme) =>
            `0 0 0 2px ${alpha(theme.palette.error.main, 0.2)}`,
        },
      };
    }

    return (
      <BaseButton
        {...props}
        ref={ref}
        sx={[
          {
            backgroundColor: 'transparent',
            '&:disabled': {
              color: (theme) => `${theme.palette.grey[500]} !important`,
              borderColor: (theme) => `${theme.palette.grey[400]} !important`,
            },
          },
          styles,
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      />
    );
  },
);

OutlinedButton.displayName = 'NhostOutlinedButton';

/**
 * A button component that does not have any border or background.
 */
const BorderlessButton = forwardRef(
  (
    { sx, color, ...props }: Omit<ButtonProps, 'variant'>,
    ref: ForwardedRef<HTMLButtonElement>,
  ) => {
    let styles: SxProps<Theme> = {
      color: 'primary.main',
      '&:hover': {
        backgroundColor: 'primary.light',
      },
      '&:active': {
        boxShadow: 'none',
        backgroundColor: 'primary.light',
      },
      '&:focus': {
        boxShadow: 'none',
        backgroundColor: 'primary.light',
      },
    };

    if (color === 'secondary') {
      styles = {
        color: 'text.primary',
        '&:hover': {
          backgroundColor: 'grey.300',
          color: 'text.primary',
        },
        '&:active': {
          backgroundColor: 'grey.300',
          boxShadow: 'none',
        },
        '&:focus': {
          backgroundColor: 'grey.300',
          boxShadow: 'none',
        },
        '&:disabled': {
          color: (theme) => `${theme.palette.text.disabled} !important`,
        },
      };
    }

    if (color === 'error') {
      styles = {
        color: 'error.main',
        '&:hover': {
          backgroundColor: (theme) => alpha(theme.palette.error.main, 0.1),
          color: 'error.dark',
        },
        '&:active': {
          backgroundColor: (theme) => alpha(theme.palette.error.main, 0.2),
          color: 'error.dark',
        },
        '&:focus': {
          boxShadow: (theme) =>
            `0 0 0 2px ${alpha(theme.palette.error.main, 0.2)}`,
          backgroundColor: (theme) => alpha(theme.palette.error.main, 0.1),
        },
      };
    }

    return (
      <BaseButton
        {...props}
        ref={ref}
        sx={[
          {
            backgroundColor: 'transparent',
            '&:disabled': {
              color: (theme) => `${theme.palette.grey[500]} !important`,
            },
          },
          styles,
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      />
    );
  },
);

BorderlessButton.displayName = 'NhostBorderlessButton';

function Button(
  {
    variant = 'contained',
    color = 'primary',
    disabled,
    loading,
    ...props
  }: ButtonProps,
  ref: ForwardedRef<HTMLButtonElement>,
) {
  const commonProps: ButtonProps = {
    ...props,
    ref,
    color,
    disabled: disabled || loading,
    startIcon: loading ? <ActivityIndicator /> : props.startIcon,
  };

  if (variant === 'borderless') {
    return <BorderlessButton {...commonProps} />;
  }

  if (variant === 'outlined') {
    return <OutlinedButton {...commonProps} />;
  }

  return <ContainedButton {...commonProps} />;
}

Button.displayName = 'NhostButton';

export default forwardRef(Button);
