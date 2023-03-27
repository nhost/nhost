import { styled } from '@mui/material';
import type { ListProps as MaterialListProps } from '@mui/material/List';
import MaterialList from '@mui/material/List';
import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';

export interface ListProps extends MaterialListProps {}

const StyledList = styled(MaterialList)(({ theme }) => ({
  borderColor: theme.palette.grey[300],
}));

function List(
  { children, ...props }: ListProps,
  ref: ForwardedRef<HTMLUListElement | HTMLOListElement>,
) {
  return (
    <StyledList ref={ref} disablePadding {...props}>
      {children}
    </StyledList>
  );
}

List.displayName = 'NhostList';

export default forwardRef(List);
