import { styled } from '@mui/material';
import type { ListItemProps as MaterialListItemProps } from '@mui/material/ListItem';
import MaterialListItemRoot from '@mui/material/ListItem';
import { listItemSecondaryActionClasses } from '@mui/material/ListItemSecondaryAction';

export interface ListItemRootProps extends MaterialListItemProps {}

const StyledListItemRoot = styled(MaterialListItemRoot)({
  justifyContent: 'initial',
  [`& .${listItemSecondaryActionClasses.root}`]: {
    right: 8,
  },
});

function ListItemRoot({ children, ...props }: ListItemRootProps) {
  return (
    <StyledListItemRoot disablePadding {...props}>
      {children}
    </StyledListItemRoot>
  );
}

ListItemRoot.displayName = 'NhostListItemRoot';

export default ListItemRoot;
