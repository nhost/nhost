import { styled } from '@mui/material';
import MaterialMenu, {
  menuClasses as materialMenuClasses,
} from '@mui/material/Menu';
import type { PopoverProps as MaterialPopoverProps } from '@mui/material/Popover';
import MaterialPopover, {
  popoverClasses as materialPopoverClasses,
} from '@mui/material/Popover';
import { useEffect } from 'react';
import useDropdown from './useDropdown';

export interface DropdownContentProps
  extends Omit<MaterialPopoverProps, 'open'> {
  /**
   * Function to be called when the menu is closed for some reason.
   */
  onClose?: (
    event: {},
    reason: 'backdropClick' | 'tabKeyDown' | 'escapeKeyDown',
  ) => void;
  /**
   * Function to be called when the menu is opened.
   */
  onOpen?: () => void;
  /**
   * Determines whether or not the dropdown content should be displayed as a
   * list of menu items. This changes the component that is rendered and also
   * the way focus is handled.
   */
  menu?: boolean;
}

const StyledMenu = styled(MaterialMenu)(({ theme }) => ({
  [`& .${materialMenuClasses.list}`]: {
    padding: 0,
  },
  [`& .${materialMenuClasses.paper}`]: {
    backgroundColor: theme.palette.background.paper,
    borderWidth: theme.palette.mode === 'dark' ? 1 : 0,
    borderColor:
      theme.palette.mode === 'dark'
        ? `${theme.palette.grey[400]} !important`
        : 'transparent',
    boxShadow:
      theme.palette.mode === 'light'
        ? '0px 4px 10px rgba(33, 50, 75, 0.25)'
        : 'none',
    border:
      theme.palette.mode === 'dark'
        ? `1px solid ${theme.palette.grey[200]}`
        : 'none',
  },
  [`& .${materialMenuClasses.list}`]: {
    padding: 0,
    backgroundColor: theme.palette.background.paper,
  },
}));

const StyledPopover = styled(MaterialPopover)(({ theme }) => ({
  [`& .${materialPopoverClasses.paper}`]: {
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.background.paper,
    backgroundImage: 'none',
    borderWidth: theme.palette.mode === 'dark' ? 1 : 0,
    borderColor:
      theme.palette.mode === 'dark'
        ? `${theme.palette.grey[400]} !important`
        : 'none',
    boxShadow:
      theme.palette.mode === 'light'
        ? '0px 4px 10px rgba(33, 50, 75, 0.25)'
        : 'none',
    border:
      theme.palette.mode === 'dark'
        ? `1px solid ${theme.palette.grey[200]}`
        : 'none',
  },
}));

function DropdownContent({
  children,
  onOpen,
  menu,
  ...props
}: DropdownContentProps) {
  const { id, open, anchorEl, handleClose } = useDropdown();
  const BaseComponent = menu ? StyledMenu : StyledPopover;

  useEffect(() => {
    if (onOpen && open) {
      onOpen();
    }
  }, [onOpen, open]);

  return (
    <BaseComponent
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      id={id}
      open={open}
      anchorEl={anchorEl}
      onClose={(event, reason) => {
        if (props.onClose) {
          props.onClose(event, reason);
        }

        handleClose();
      }}
      PaperProps={{
        ...props.PaperProps,
        sx: [
          {
            borderRadius: '0.5rem',
            boxShadow: '0px 4px 10px rgba(33, 50, 75, 0.25)',
            fontFamily: (theme) => theme.typography.fontFamily,
          },
        ],
      }}
      {...props}
    >
      {children}
    </BaseComponent>
  );
}

DropdownContent.displayName = 'NhostDropdownContent';

export default DropdownContent;
