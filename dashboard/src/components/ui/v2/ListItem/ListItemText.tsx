import { styled } from '@mui/material';
import type { ListItemTextProps as MaterialListItemTextProps } from '@mui/material/ListItemText';
import MaterialListItemText, {
  listItemTextClasses,
} from '@mui/material/ListItemText';

export interface ListItemTextProps extends MaterialListItemTextProps {}

const StyledListItemText = styled(MaterialListItemText)(({ theme }) => ({
  color: theme.palette.text.primary,
  display: 'grid',
  justifyContent: 'start',
  gridAutoFlow: 'row',
  gap: theme.spacing(0.5),
  fontSize: theme.typography.pxToRem(15),
  [`&.${listItemTextClasses.root}`]: {
    margin: 0,
  },
  [`& > .${listItemTextClasses.primary}`]: {
    fontWeight: 500,
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  },
  [`& > .${listItemTextClasses.secondary}`]: {
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  },
}));

function ListItemText({ children, ...props }: ListItemTextProps) {
  return <StyledListItemText {...props}>{children}</StyledListItemText>;
}

ListItemText.displayName = 'NhostListItemText';

export default ListItemText;
