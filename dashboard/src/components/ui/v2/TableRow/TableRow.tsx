import { styled } from '@mui/material';
import type { TableRowProps as MaterialTableRowProps } from '@mui/material/TableRow';
import MaterialTableRow from '@mui/material/TableRow';

export interface TableRowProps extends MaterialTableRowProps {}

const StyledTableRow = styled(MaterialTableRow)(({ theme }) => ({
  borderColor: theme.palette.grey[300],
}));

function TableRow({ children, ...props }: TableRowProps) {
  return <StyledTableRow {...props}>{children}</StyledTableRow>;
}

TableRow.displayName = 'NhostTableRow';

export default TableRow;
