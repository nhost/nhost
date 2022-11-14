import type { TableHeadProps as MaterialTableHeadProps } from '@mui/material/TableHead';
import MaterialTableHead from '@mui/material/TableHead';

export interface TableHeadProps extends MaterialTableHeadProps {}

function TableHead({ children, ...props }: TableHeadProps) {
  return <MaterialTableHead {...props}>{children}</MaterialTableHead>;
}

TableHead.displayName = 'NhostTableHead';

export default TableHead;
