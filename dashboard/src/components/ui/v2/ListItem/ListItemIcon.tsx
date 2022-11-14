import { styled } from '@mui/material';
import type { ListItemIconProps as MaterialListItemIconProps } from '@mui/material/ListItemIcon';
import MaterialListItemIcon from '@mui/material/ListItemIcon';

export interface ListItemIconProps extends MaterialListItemIconProps {}

const StyledListItemIcon = styled(MaterialListItemIcon)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: theme.palette.text.primary,
  minWidth: 'initial',
  width: '1.125rem',
  height: '1.125rem',
}));

function ListItemIcon({ children, ...props }: ListItemIconProps) {
  return <StyledListItemIcon {...props}>{children}</StyledListItemIcon>;
}

ListItemIcon.displayName = 'NhostListItemIcon';

export default ListItemIcon;
