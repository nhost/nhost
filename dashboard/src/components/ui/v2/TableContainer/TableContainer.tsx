import { styled } from '@mui/material';
import type { TableContainerProps as MaterialTableContainerProps } from '@mui/material/TableContainer';
import MaterialTableContainer from '@mui/material/TableContainer';
import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';

export interface TableContainerProps extends MaterialTableContainerProps {}

const StyledTableContainer = styled(MaterialTableContainer)(({ theme }) => ({
  borderColor: theme.palette.grey[300],
  backgroundColor: theme.palette.background.default,
}));

function TableContainer(
  { children, ...props }: TableContainerProps,
  ref: ForwardedRef<HTMLDivElement>,
) {
  return (
    <StyledTableContainer ref={ref} {...props}>
      {children}
    </StyledTableContainer>
  );
}

TableContainer.displayName = 'NhostTableContainer';

export default forwardRef(TableContainer);
