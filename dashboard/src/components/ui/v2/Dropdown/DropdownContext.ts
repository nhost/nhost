import type { MouseEvent } from 'react';
import { createContext } from 'react';

export interface DropdownContextProps {
  id?: string;
  open: boolean;
  anchorEl: HTMLButtonElement | null;
  handleOpen: (event: MouseEvent<HTMLButtonElement>) => void;
  handleClose: VoidFunction;
}

export default createContext<DropdownContextProps>({
  open: false,
  anchorEl: null,
  handleOpen: () => {},
  handleClose: () => {},
});
