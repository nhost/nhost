import type { TableProps as MaterialTableProps } from '@mui/material/Table';
import MaterialTable from '@mui/material/Table';
import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';

export interface TableProps extends MaterialTableProps {}

function Table(
  { children, ...props }: TableProps,
  ref: ForwardedRef<HTMLTableElement>,
) {
  return (
    <MaterialTable ref={ref} {...props}>
      {children}
    </MaterialTable>
  );
}

Table.displayName = 'NhostTable';

export default forwardRef(Table);
