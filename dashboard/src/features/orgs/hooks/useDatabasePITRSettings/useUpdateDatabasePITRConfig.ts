import { useIsPITREnabled } from '@/features/orgs/hooks/useIsPITREnabled';
import { useEffect, useState } from 'react';

function useDatabasePITRSettings() {
  const [isPITREnabled, setIsPITREnabled] = useState(false);
  const [isNotSwitchTouched, setIsNotSwitchTouched] = useState(true);

  const isPITREnabledData = useIsPITREnabled();
  useEffect(() => {
    setIsPITREnabled(isPITREnabledData);
  }, [isPITREnabledData]);

  const isSwitchDisabled =
    isPITREnabled === isPITREnabledData || isNotSwitchTouched;

  return {
    isPITREnabled,
    setIsPITREnabled,
    isSwitchDisabled,
    setIsNotSwitchTouched,
  };
}

export default useDatabasePITRSettings;
