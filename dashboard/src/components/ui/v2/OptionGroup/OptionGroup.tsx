import type { OptionGroupUnstyledProps } from '@mui/base/OptionGroupUnstyled';
import OptionGroupUnstyled from '@mui/base/OptionGroupUnstyled';
import { styled } from '@mui/material';
import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';
import OptionGroupBase from './OptionGroupBase';

export interface OptionGroupProps extends OptionGroupUnstyledProps {}

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

  return <OptionGroupUnstyled {...props} ref={ref} slots={slots} />;
}

OptionGroup.displayName = 'NhostOptionGroup';

export default forwardRef(OptionGroup);
