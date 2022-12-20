import type { ListProps as MaterialListProps } from '@mui/material/List';
import MaterialList from '@mui/material/List';
import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';

export interface ListProps extends MaterialListProps {}

function List(
  { children, ...props }: ListProps,
  ref: ForwardedRef<HTMLUListElement | HTMLOListElement>,
) {
  return (
    <MaterialList ref={ref} disablePadding {...props}>
      {children}
    </MaterialList>
  );
}

List.displayName = 'NhostList';

export default forwardRef(List);
