import type { BoxProps } from '@mui/material/Box';
import Box from '@mui/material/Box';
import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';
import type { DropdownProviderProps } from './DropdownProvider';
import DropdownProvider from './DropdownProvider';

export interface DropdownRootProps extends BoxProps, DropdownProviderProps {}

function DropdownRoot(
  { children, onClose, onOpen, ...props }: DropdownRootProps,
  ref: ForwardedRef<BoxProps>,
) {
  return (
    <DropdownProvider onClose={onClose} onOpen={onOpen} id={props.id}>
      <Box ref={ref} {...props}>
        {children}
      </Box>
    </DropdownProvider>
  );
}

DropdownRoot.displayName = 'NhostDropdownRoot';

export default forwardRef(DropdownRoot);
