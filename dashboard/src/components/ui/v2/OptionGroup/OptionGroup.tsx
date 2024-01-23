import {
  OptionGroup as BaseOptionGroup,
  type OptionGroupProps as BaseOptionGroupProps,
} from '@mui/base';
import { styled } from '@mui/material';
import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';
import OptionGroupBase from './OptionGroupBase';

export interface OptionGroupProps extends BaseOptionGroupProps {}

const StyledGroupRoot = styled('li')(({ theme }) => ({
  listStyle: 'none',
  backgroundColor: 'transparent',
  '&:not(:first-of-type)': {
    marginTop: theme.spacing(1),
  },
}));

function OptionGroup(
  { slots: externalSlots, ...props }: OptionGroupProps,
  ref: ForwardedRef<any>,
) {
  const slots: typeof externalSlots = {
    root: StyledGroupRoot,
    label: OptionGroupBase,
    ...externalSlots,
  };

  return <BaseOptionGroup {...props} ref={ref} slots={slots} />;
}

OptionGroup.displayName = 'NhostOptionGroup';

export default forwardRef(OptionGroup);
