import { styled } from '@mui/material';
import type { ListItemAvatarProps as MaterialListItemAvatarProps } from '@mui/material/ListItemAvatar';
import MaterialListItemAvatar from '@mui/material/ListItemAvatar';

export interface ListItemAvatarProps extends MaterialListItemAvatarProps {}

const StyledListItemAvatar = styled(MaterialListItemAvatar)({
  minWidth: 0,
});

function ListItemAvatar({ children, ...props }: ListItemAvatarProps) {
  return <StyledListItemAvatar {...props}>{children}</StyledListItemAvatar>;
}

ListItemAvatar.displayName = 'NhostListItemAvatar';

export default ListItemAvatar;
