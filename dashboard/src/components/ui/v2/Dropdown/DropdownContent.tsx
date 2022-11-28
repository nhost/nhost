import { styled } from '@mui/material';
import MaterialMenu, {
  menuClasses as materialMenuClasses,
} from '@mui/material/Menu';
import type { PopoverProps as MaterialPopoverProps } from '@mui/material/Popover';
import MaterialPopover from '@mui/material/Popover';
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

const StyledMenu = styled(MaterialMenu)({
  [`& .${materialMenuClasses.list}`]: {
    padding: 0,
  },
  [`& .${materialMenuClasses.paper}`]: {
    boxShadow: '0px 4px 10px rgba(33, 50, 75, 0.25)',
  },
});

function DropdownContent({
  children,
  onOpen,
  menu,
  ...props
}: DropdownContentProps) {
  const { id, open, anchorEl, handleClose } = useDropdown();
  const BaseComponent = menu ? StyledMenu : MaterialPopover;

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
