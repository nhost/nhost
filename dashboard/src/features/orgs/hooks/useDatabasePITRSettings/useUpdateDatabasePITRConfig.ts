import { useIsPITREnabled } from '@/features/orgs/hooks/useIsPITREnabled';
import { useEffect, useState } from 'react';

function useDatabasePITRSettings() {
  const [isPITREnabled, setIsPITREnabled] = useState(false);
  const [isNotSwitchTouched, setIsNotSwitchTouched] = useState(true);

  const isPITREnabledData = useIsPITREnabled();
  useEffect(() => {
    setIsPITREnabled(isPITREnabledData);
  }, [isPITREnabledData]);

  return {
    isPITREnabled,
    setIsPITREnabled,
    isNotSwitchTouched,
    setIsNotSwitchTouched,
  };
}

export default useDatabasePITRSettings;
