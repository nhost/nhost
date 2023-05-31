import useDropdown from '@/components/ui/v2/Dropdown/useDropdown';
import { styled } from '@mui/material';
import { buttonBaseClasses } from '@mui/material/ButtonBase';
import { dividerClasses } from '@mui/material/Divider';
import type { MenuItemProps as MaterialMenuItemProps } from '@mui/material/MenuItem';
import MaterialMenuItem from '@mui/material/MenuItem';
import type { ForwardedRef, MouseEvent } from 'react';
import { forwardRef } from 'react';

export interface DropdownItemProps extends MaterialMenuItemProps {
  /**
   * Determines whether or not the dropdown should be closed when the user
   * selects the dropdown item.
   *
   * @default true
   */
  closeOnClick?: boolean;
  /**
   * Determines whether or not the dropdown item is active.
   */
  active?: boolean;
}

const StyledDropdownItem = styled(MaterialMenuItem)(({ theme }) => ({
  padding: theme.spacing(0.75, 1),
  transition: theme.transitions.create(['background-color', 'color']),
  width: '100%',
  [`&.${buttonBaseClasses.root}+.${dividerClasses.root}`]: {
    margin: theme.spacing(0.5, 0),
  },
  '&:focus': {
    outline: 'none',
  },
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

function DropdownItem(
  { closeOnClick = true, children, active, sx, ...props }: DropdownItemProps,
  ref: ForwardedRef<HTMLLIElement>,
) {
  const { handleClose } = useDropdown();

  function handleClick(event: MouseEvent<HTMLLIElement>) {
    if (props.onClick) {
      props.onClick(event);
    }

    if (closeOnClick) {
      handleClose();
    }
  }

  return (
    <StyledDropdownItem
      disableRipple
      sx={[
        {
          backgroundColor: (theme) => {
            if (active) {
              return theme.palette.grey[300];
            }

            if (props.selected) {
              return theme.palette.grey[200];
            }

            return theme.palette.background.paper;
          },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...props}
      ref={ref}
      onClick={handleClick}
    >
      {children}
    </StyledDropdownItem>
  );
}

DropdownItem.displayName = 'NhostDropdownItem';

export default forwardRef(DropdownItem);
