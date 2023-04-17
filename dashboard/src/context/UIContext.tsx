import { useRouter } from 'next/router';
import type { PropsWithChildren } from 'react';
import { createContext, useContext, useMemo } from 'react';

export interface UIContextState {
  /**
   * Determines whether or not the dashboard is in maintenance mode.
   */
  maintenanceActive: boolean;
  /**
   * The date and time when maintenance mode will end.
   */
  maintenanceEndDate: Date;
}

export const UIContext = createContext<UIContextState>({
  maintenanceActive: false,
  maintenanceEndDate: null,
});

UIContext.displayName = 'UIContext';

export function UIProvider(props: PropsWithChildren<unknown>) {
  const router = useRouter();

  const maintenanceUnlocked =
    process.env.NEXT_PUBLIC_MAINTENANCE_UNLOCK_SECRET &&
    process.env.NEXT_PUBLIC_MAINTENANCE_UNLOCK_SECRET ===
      router.query.maintenanceUnlockSecret;

  const value: UIContextState = useMemo(
    () => ({
      maintenanceActive: maintenanceUnlocked
        ? false
        : process.env.NEXT_PUBLIC_MAINTENANCE_ACTIVE === 'true',
      maintenanceEndDate:
        process.env.NEXT_PUBLIC_MAINTENANCE_END_DATE &&
        !Number.isNaN(Date.parse(process.env.NEXT_PUBLIC_MAINTENANCE_END_DATE))
          ? new Date(Date.parse(process.env.NEXT_PUBLIC_MAINTENANCE_END_DATE))
          : null,
    }),
    [maintenanceUnlocked],
  );

  return <UIContext.Provider value={value} {...props} />;
}

export const useUI = () => {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};

export function ManagedUIContext({ children }: PropsWithChildren<unknown>) {
  return <UIProvider>{children}</UIProvider>;
}
