import { Backdrop } from '@/components/ui/v2/Backdrop';
import type { DialogTitleProps } from '@/components/ui/v2/Dialog';
import { DialogTitle } from '@/components/ui/v2/Dialog';
import { styled } from '@mui/material';
import type { DrawerProps as MaterialDrawerProps } from '@mui/material/Drawer';
import MaterialDrawer, { drawerClasses } from '@mui/material/Drawer';
import type { ReactNode } from 'react';

export interface DrawerProps extends Omit<MaterialDrawerProps, 'title'> {
  /**
   * Title of the drawer.
   */
  title?: ReactNode;
  /**
   * Props to pass to the title component.
   */
  titleProps?: DialogTitleProps;
  /**
   * Determines whether or not a close button is hidden in the drawer.
   *
   * @default false
   */
  hideCloseButton?: boolean;
}

const StyledDrawer = styled(MaterialDrawer)(({ theme }) => ({
  [`& .${drawerClasses.paper}`]: {
    display: 'flex',
    boxShadow:
      '0px 1px 4px rgba(14, 24, 39, 0.1), 0px 8px 24px rgba(14, 24, 39, 0.1)',
    backgroundColor: theme.palette.background.paper,
    backgroundImage: 'none',
  },
}));

function Drawer({
  hideCloseButton,
  children,
  onClose,
  title,
  titleProps: { sx: titleSx, ...titleProps } = {},
  ...props
}: DrawerProps) {
  return (
    <StyledDrawer components={{ Backdrop }} onClose={onClose} {...props}>
      {onClose && !hideCloseButton && (
        <DialogTitle
          {...titleProps}
          sx={[
            ...(Array.isArray(titleSx) ? titleSx : [titleSx]),
            { padding: (theme) => theme.spacing(2.5, 3) },
          ]}
          onClose={(event) => onClose(event, 'escapeKeyDown')}
        >
          {title}
        </DialogTitle>
      )}

      {children}
    </StyledDrawer>
  );
}

Drawer.displayName = 'NhostDrawer';

export default Drawer;
