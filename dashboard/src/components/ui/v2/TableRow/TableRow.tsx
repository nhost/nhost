import type { TableRowProps as MaterialTableRowProps } from '@mui/material/TableRow';
import MaterialTableRow from '@mui/material/TableRow';

export interface TableRowProps extends MaterialTableRowProps {}

function TableRow({ children, ...props }: TableRowProps) {
  return <MaterialTableRow {...props}>{children}</MaterialTableRow>;
}

TableRow.displayName = 'NhostTableRow';

export default TableRow;
