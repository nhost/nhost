import {
  Option as BaseOption,
  optionClasses as baseOptionClasses,
  type OptionProps as BaseOptionProps,
} from '@mui/base';
import { darken, styled } from '@mui/material';
import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';
import OptionBase from './OptionBase';

export interface OptionProps<TValue extends {}>
  extends BaseOptionProps<TValue> {}

const StyledOption = styled(BaseOption)(({ theme }) => ({
  transition: theme.transitions.create(['background-color']),
  color: theme.palette.text.primary,
  [`&.${baseOptionClasses.selected}`]: {
    backgroundColor:
      theme.palette.mode === 'dark'
        ? `${darken(theme.palette.action.hover, 0.1)} !important`
        : `${darken(theme.palette.action.hover, 0.05)} !important`,
  },
  [`&.${baseOptionClasses.selected}:hover, &.${baseOptionClasses.selected}.${baseOptionClasses.highlighted}`]:
    {
      backgroundColor:
        theme.palette.mode === 'dark'
          ? `${darken(theme.palette.action.hover, 0.25)} !important`
          : `${darken(theme.palette.action.hover, 0.075)} !important`,
    },
  [`&.${baseOptionClasses.highlighted}, &:hover`]: {
    backgroundColor:
      theme.palette.mode === 'dark'
        ? `${darken(theme.palette.action.hover, 0.15)} !important`
        : `${theme.palette.action.hover} !important`,
  },
  [`&.${baseOptionClasses.disabled}`]: {
    color: theme.palette.text.disabled,
  },
  [`&.${baseOptionClasses.disabled}:hover`]: {
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
