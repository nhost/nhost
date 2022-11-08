import type { TableContainerProps as MaterialTableContainerProps } from '@mui/material/TableContainer';
import MaterialTableContainer from '@mui/material/TableContainer';
import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';

export interface TableContainerProps extends MaterialTableContainerProps {}

function TableContainer(
  { children, ...props }: TableContainerProps,
  ref: ForwardedRef<HTMLDivElement>,
) {
  return (
    <MaterialTableContainer ref={ref} {...props}>
      {children}
    </MaterialTableContainer>
  );
}

TableContainer.displayName = 'NhostTableContainer';

export default forwardRef(TableContainer);
