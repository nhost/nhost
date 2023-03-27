import { styled } from '@mui/material';
import type { TableCellProps as MaterialTableCellProps } from '@mui/material/TableCell';
import MaterialTableCell, { tableCellClasses } from '@mui/material/TableCell';

export interface TableCellProps extends MaterialTableCellProps {}

const StyledTableCell = styled(MaterialTableCell)(({ theme }) => ({
  borderColor: theme.palette.grey[300],
  [`&.${tableCellClasses.head}`]: {
    fontSize: theme.typography.pxToRem(12),
    lineHeight: theme.typography.pxToRem(16),
  },
}));

function TableCell({ children, ...props }: TableCellProps) {
  return <StyledTableCell {...props}>{children}</StyledTableCell>;
}

TableCell.displayName = 'NhostTableCell';

export default TableCell;
