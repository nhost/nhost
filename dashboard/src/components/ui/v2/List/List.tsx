import type { ListProps as MaterialListProps } from '@mui/material/List';
import MaterialList from '@mui/material/List';

export interface ListProps extends MaterialListProps {}

function List({ children, ...props }: ListProps) {
  return (
    <MaterialList disablePadding {...props}>
      {children}
    </MaterialList>
  );
}

List.displayName = 'NhostList';

export default List;
