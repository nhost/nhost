import type { TableCellProps as MaterialTableCellProps } from '@mui/material/TableCell';
import MaterialTableCell from '@mui/material/TableCell';

export interface TableCellProps extends MaterialTableCellProps {}

function TableCell({ children, ...props }: TableCellProps) {
  return <MaterialTableCell {...props}>{children}</MaterialTableCell>;
}

TableCell.displayName = 'NhostTableCell';

export default TableCell;
