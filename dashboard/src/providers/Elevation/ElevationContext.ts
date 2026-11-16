import { createContext } from 'react';

export interface ElevationContextProps {
  /**
   * Elevates the current session if the backend requires it, prompting the
   * user to verify their identity with one of the methods available to them.
   * Resolves to whether the session is elevated, or to `false` when a newer
   * request replaces this one before the dialog settles.
   */
  requestElevation: () => Promise<boolean>;
}

export const ElevationContext = createContext<ElevationContextProps | null>(
  null,
);
