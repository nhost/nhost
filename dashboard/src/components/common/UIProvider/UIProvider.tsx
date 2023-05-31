import { useRouter } from 'next/router';
import type { PropsWithChildren } from 'react';
import { useMemo } from 'react';
import type { UIContextProps } from './UIContext';
import UIContext from './UIContext';

export default function UIProvider(props: PropsWithChildren<unknown>) {
  const router = useRouter();

  const maintenanceUnlocked =
    process.env.NEXT_PUBLIC_MAINTENANCE_UNLOCK_SECRET &&
    process.env.NEXT_PUBLIC_MAINTENANCE_UNLOCK_SECRET ===
      router.query.maintenanceUnlockSecret;

  const value: UIContextProps = useMemo(
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
