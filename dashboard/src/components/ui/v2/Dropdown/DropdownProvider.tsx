import type { MouseEvent, PropsWithChildren } from 'react';
import { useCallback, useMemo, useState } from 'react';
import DropdownContext from './DropdownContext';

export interface DropdownProviderProps {
  /**
   * Dropdown identifier. Used for accessibility purposes.
   */
  id?: string;
  /**
   * Function to be called when the dropdown is opened.
   */
  onOpen?: VoidFunction;
  /**
   * Function to be called when the dropdown is closed.
   */
  onClose?: VoidFunction;
}

function DropdownProvider({
  id: userSpecifiedId,
  onOpen,
  onClose,
  children,
}: PropsWithChildren<DropdownProviderProps>) {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const open = Boolean(anchorEl);

  const id = open ? userSpecifiedId : undefined;

  const handleOpen = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      setAnchorEl(event.currentTarget);

      if (onOpen) {
        onOpen();
      }
    },
    [onOpen],
  );

  const handleClose = useCallback(() => {
    setAnchorEl(null);

    if (onClose) {
      onClose();
    }
  }, [onClose]);

  const value = useMemo(
    () => ({
      id,
      open,
      anchorEl,
      handleOpen,
      handleClose,
    }),
    [id, open, handleOpen, handleClose, anchorEl],
  );

  return (
    <DropdownContext.Provider value={value}>
      {children}
    </DropdownContext.Provider>
  );
}

DropdownProvider.displayName = 'NhostDropdownProvider';

export default DropdownProvider;
