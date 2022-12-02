import {
  listItemIconClasses,
  listItemTextClasses,
  styled,
} from '@mui/material';
import type { ListItemButtonProps as MaterialListItemButtonProps } from '@mui/material/ListItemButton';
import MaterialListItemButton, {
  getListItemButtonUtilityClass,
  listItemButtonClasses,
} from '@mui/material/ListItemButton';
import clsx from 'clsx';
import type { ElementType, ForwardedRef } from 'react';
import { forwardRef } from 'react';

export type ListItemButtonProps<
  D extends ElementType = ElementType<any>,
  P = {},
> = MaterialListItemButtonProps<D, P> & {
  /**
   * Reduces the vertical padding.
   *
   * @default false
   */
  dense?: boolean;
};

const StyledListItemButton = styled(MaterialListItemButton)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  fontSize: '0.9375rem',
  fontWeight: 500,
  padding: theme.spacing(1.25),
  display: 'grid',
  gridAutoFlow: 'column',
  alignItems: 'center',
  gap: theme.spacing(),
  [`&.${getListItemButtonUtilityClass('dense')}`]: {
    padding: theme.spacing(1, 1.25),
  },
  [`&.${listItemButtonClasses.selected}`]: {
    backgroundColor: theme.palette.primary.light,
    color: theme.palette.primary.main,
  },
  [`&.${listItemButtonClasses.selected} > .${listItemTextClasses.root}`]: {
    color: theme.palette.primary.main,
  },
  [`&.${listItemButtonClasses.selected} > .${listItemTextClasses.primary}`]: {
    fontWeight: 600,
  },
  [`&.${listItemButtonClasses.selected} > .${listItemIconClasses.root}`]: {
    color: theme.palette.primary.main,
  },
  [`&.${listItemButtonClasses.selected}:hover`]: {
    backgroundColor: theme.palette.primary.light,
  },
}));

function ListItemButton<D extends ElementType<any>, P>(
  { children, dense, className, ...props }: ListItemButtonProps<D, P>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  return (
    <StyledListItemButton
      ref={ref}
      className={clsx(
        dense ? getListItemButtonUtilityClass('dense') : '',
        className,
      )}
      disableRipple
      {...props}
    >
      {children}
    </StyledListItemButton>
  );
}

ListItemButton.displayName = 'NhostListItemButton';

export default forwardRef(ListItemButton);
