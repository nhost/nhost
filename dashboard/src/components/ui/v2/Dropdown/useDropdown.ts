import { useContext } from 'react';
import type { DropdownContextProps } from './DropdownContext';
import DropdownContext from './DropdownContext';

export default function useDropdown(): DropdownContextProps {
  const context = useContext(DropdownContext);

  if (!context) {
    return {
      open: false,
      anchorEl: null,
      handleOpen: () => {},
      handleClose: () => {},
    };
  }

  return context;
}
