import type { OptionUnstyledProps } from '@mui/base/OptionUnstyled';
import OptionUnstyled, {
  optionUnstyledClasses,
} from '@mui/base/OptionUnstyled';
import { darken, styled } from '@mui/material';
import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';
import OptionBase from './OptionBase';

export interface OptionProps<TValue extends {}>
  extends OptionUnstyledProps<TValue> {}

const StyledOption = styled(OptionUnstyled)(({ theme }) => ({
  [`&.${optionUnstyledClasses.highlighted}`]: {
    backgroundColor: darken(theme.palette.action.active, 0.025),
  },
  [`&.${optionUnstyledClasses.highlighted}:hover`]: {
    backgroundColor: darken(theme.palette.action.hover, 0.1),
  },
  [`&.${optionUnstyledClasses.disabled}`]: {
    color: theme.palette.text.disabled,
  },
  [`&:hover:not(.${optionUnstyledClasses.disabled}):not(.${optionUnstyledClasses.highlighted})`]:
    {
      backgroundColor: theme.palette.action.hover,
    },
}));

function Option<TValue>(
  { children, ...props }: OptionProps<TValue>,
  ref: ForwardedRef<HTMLLIElement>,
) {
  return (
    <StyledOption slots={{ root: OptionBase }} {...props} ref={ref}>
      {children}
    </StyledOption>
  );
}

Option.displayName = 'NhostOption';

export default forwardRef(Option);
