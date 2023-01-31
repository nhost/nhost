import { styled } from '@mui/material';
import type { TableBodyProps as MaterialTableBodyProps } from '@mui/material/TableBody';
import MaterialTableBody from '@mui/material/TableBody';

export interface TableBodyProps extends MaterialTableBodyProps {}

const StyledTableBody = styled(MaterialTableBody)(({ theme }) => ({
  borderColor: theme.palette.grey[300],
}));

function TableBody({ children, ...props }: TableBodyProps) {
  return <StyledTableBody {...props}>{children}</StyledTableBody>;
}

TableBody.displayName = 'NhostTableBody';

export default TableBody;
