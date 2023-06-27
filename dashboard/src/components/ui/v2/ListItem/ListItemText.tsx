import { textClasses } from '@/components/ui/v2/Text';
import { getTypographyUtilityClass, styled } from '@mui/material';
import type { ListItemTextProps as MaterialListItemTextProps } from '@mui/material/ListItemText';
import MaterialListItemText, {
  listItemTextClasses as materialListItemTextClasses,
} from '@mui/material/ListItemText';
import clsx from 'clsx';

export interface ListItemTextProps extends MaterialListItemTextProps {}

const listItemTextClasses = {
  ...materialListItemTextClasses,
  warning: getTypographyUtilityClass('colorWarning'),
};

const StyledListItemText = styled(MaterialListItemText)(({ theme }) => ({
  color: theme.palette.text.primary,
  display: 'grid',
  justifyContent: 'start',
  gridAutoFlow: 'row',
  gap: theme.spacing(0.25),
  fontSize: theme.typography.pxToRem(15),
  [`&.${listItemTextClasses.root}`]: {
    margin: 0,
  },
  [`&.${listItemTextClasses.warning}`]: {
    color: theme.palette.warning.dark,
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

function ListItemText({
  children,
  color = 'primary',
  className,
  ...props
}: ListItemTextProps) {
  return (
    <StyledListItemText
      className={clsx(
        color === 'warning' && textClasses.colorWarning,
        className,
      )}
      {...props}
    >
      {children}
    </StyledListItemText>
  );
}

ListItemText.displayName = 'NhostListItemText';

export default ListItemText;
