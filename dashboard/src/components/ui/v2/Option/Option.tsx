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
  transition: theme.transitions.create(['background-color']),
  [`&.${optionUnstyledClasses.selected}`]: {
    backgroundColor:
      theme.palette.mode === 'dark'
        ? `${darken(theme.palette.action.hover, 0.1)} !important`
        : `${darken(theme.palette.action.hover, 0.05)} !important`,
  },
  [`&.${optionUnstyledClasses.selected}:hover, &.${optionUnstyledClasses.selected}.${optionUnstyledClasses.highlighted}`]:
    {
      backgroundColor:
        theme.palette.mode === 'dark'
          ? `${darken(theme.palette.action.hover, 0.25)} !important`
          : `${darken(theme.palette.action.hover, 0.075)} !important`,
    },
  [`&.${optionUnstyledClasses.highlighted}, &:hover`]: {
    backgroundColor:
      theme.palette.mode === 'dark'
        ? `${darken(theme.palette.action.hover, 0.15)} !important`
        : `${theme.palette.action.hover} !important`,
  },
  [`&.${optionUnstyledClasses.disabled}`]: {
    color: theme.palette.text.disabled,
  },
  [`&.${optionUnstyledClasses.disabled}:hover`]: {
    backgroundColor: 'transparent !important',
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
