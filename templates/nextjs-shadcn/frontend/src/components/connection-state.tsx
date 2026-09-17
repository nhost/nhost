'use client';

import { createContext, type ReactNode, useContext, useState } from 'react';
import type { ConnectionResult } from '@/app/actions';

type ConnectionState = {
  /** The last test someone asked for, or null if nobody has yet. */
  measured: ConnectionResult | null;
  setMeasured: (result: ConnectionResult) => void;
};

const Context = createContext<ConnectionState | null>(null);

/**
 * Remembers the result of a manual connection test.
 *
 * It sits in the root layout rather than in the tile because switching views
 * re-creates the tile: kept locally, a reading would vanish every time you
 * moved between home and the protected page, which reads as the test having
 * never been run rather than as the component having been replaced.
 */
export function ConnectionStateProvider({ children }: { children: ReactNode }) {
  const [measured, setMeasured] = useState<ConnectionResult | null>(null);

  return (
    <Context.Provider value={{ measured, setMeasured }}>
      {children}
    </Context.Provider>
  );
}

export function useConnectionState(): ConnectionState {
  const state = useContext(Context);

  if (!state) {
    throw new Error(
      'useConnectionState must be used inside a ConnectionStateProvider',
    );
  }

  return state;
}
