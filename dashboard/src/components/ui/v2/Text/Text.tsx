import { styled } from '@mui/material';
import type {
  TypographyProps as MaterialTypographyProps,
  TypographyTypeMap,
} from '@mui/material/Typography';
import MaterialTypography, {
  getTypographyUtilityClass,
  typographyClasses as materialTypographyClasses,
} from '@mui/material/Typography';
import clsx from 'clsx';

export type TextProps<
  D extends React.ElementType = TypographyTypeMap['defaultComponent'],
  P = {},
> = MaterialTypographyProps<D, P> & {
  /**
   * The color of the text.
   *
   * @default 'primary'
   */
  color?: 'primary' | 'secondary' | 'disabled' | 'error';
};

const textClasses = {
  ...materialTypographyClasses,
  colorPrimary: getTypographyUtilityClass('colorPrimary'),
  colorSecondary: getTypographyUtilityClass('colorSecondary'),
  colorDisabled: getTypographyUtilityClass('colorDisabled'),
  colorError: getTypographyUtilityClass('colorError'),
};

const StyledTypography = styled(MaterialTypography)<TextProps>(({ theme }) => ({
  color: theme.palette.text.primary,
  [`&.${textClasses.subtitle1}`]: {
    color: theme.palette.text.secondary,
  },
  [`&.${textClasses.subtitle2}`]: {
    color: theme.palette.text.secondary,
  },
  [`&.${textClasses.colorSecondary}`]: {
    color: theme.palette.text.secondary,
  },
  [`&.${textClasses.colorDisabled}`]: {
    color: theme.palette.text.disabled,
  },
  [`&.${textClasses.colorError}`]: {
    color: theme.palette.error.main,
  },
}));

function Text<
  D extends React.ElementType = TypographyTypeMap['defaultComponent'],
  P = {},
>({
  children,
  variantMapping,
  color = 'primary',
  className,
  ...props
}: TextProps<D, P>) {
  return (
    <StyledTypography
      variantMapping={{ subtitle1: 'p', subtitle2: 'p', ...variantMapping }}
      className={clsx(
        color === 'primary' && textClasses.colorPrimary,
        color === 'secondary' && textClasses.colorSecondary,
        color === 'disabled' && textClasses.colorDisabled,
        color === 'error' && textClasses.colorError,
        className,
      )}
      {...props}
    >
      {children}
    </StyledTypography>
  );
}

Text.displayName = 'NhostText';

export { textClasses };

export default Text;
