import { styled } from '@mui/material';
import type {
  TypographyProps as MaterialTypographyProps,
  TypographyTypeMap,
} from '@mui/material/Typography';
import MaterialTypography, {
  typographyClasses as materialTypographyClasses,
} from '@mui/material/Typography';

export type TextProps<
  D extends React.ElementType = TypographyTypeMap['defaultComponent'],
  P = {},
> = MaterialTypographyProps<D, P>;

const StyledTypography = styled(MaterialTypography)<TextProps>(({ theme }) => ({
  color: theme.palette.text.primary,
  [`&.${materialTypographyClasses.subtitle1}`]: {
    color: theme.palette.text.secondary,
  },
  [`&.${materialTypographyClasses.subtitle2}`]: {
    color: theme.palette.text.secondary,
  },
}));

function Text<
  D extends React.ElementType = TypographyTypeMap['defaultComponent'],
  P = {},
>({ children, variantMapping, ...props }: TextProps<D, P>) {
  return (
    <StyledTypography
      variantMapping={{ subtitle1: 'p', subtitle2: 'p', ...variantMapping }}
      {...props}
    >
      {children}
    </StyledTypography>
  );
}

Text.displayName = 'NhostText';

export default Text;
