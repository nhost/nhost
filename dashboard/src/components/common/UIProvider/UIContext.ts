import { createContext } from 'react';

export interface UIContextProps {
  /**
   * Determines whether or not the dashboard is in maintenance mode.
   */
  maintenanceActive: boolean;
  /**
   * The date and time when maintenance mode will end.
   */
  maintenanceEndDate: Date | null;
}

const UIContext = createContext<UIContextProps>({
  maintenanceActive: false,
  maintenanceEndDate: null,
});

export default UIContext;
