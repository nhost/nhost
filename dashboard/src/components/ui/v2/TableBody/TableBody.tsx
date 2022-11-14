import type { TableBodyProps as MaterialTableBodyProps } from '@mui/material/TableBody';
import MaterialTableBody from '@mui/material/TableBody';

export interface TableBodyProps extends MaterialTableBodyProps {}

function TableBody({ children, ...props }: TableBodyProps) {
  return <MaterialTableBody {...props}>{children}</MaterialTableBody>;
}

TableBody.displayName = 'NhostTableBody';

export default TableBody;
