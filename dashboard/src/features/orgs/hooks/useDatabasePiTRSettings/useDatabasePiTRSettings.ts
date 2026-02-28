import { useEffect, useState } from 'react';
import { useIsPiTREnabled } from '@/features/orgs/hooks/useIsPiTREnabled';

function useDatabasePiTRSettings() {
  const [isPiTREnabled, setIsPiTREnabled] = useState(false);
  const [isNotSwitchTouched, setIsNotSwitchTouched] = useState(true);

  const { isPiTREnabled: isPiTREnabledData } = useIsPiTREnabled();
  useEffect(() => {
    setIsPiTREnabled(isPiTREnabledData);
  }, [isPiTREnabledData]);

  const isSwitchDisabled =
    isPiTREnabled === isPiTREnabledData || isNotSwitchTouched;

  return {
    isPiTREnabled,
    setIsPiTREnabled,
    isSwitchDisabled,
    setIsNotSwitchTouched,
  };
}

export default useDatabasePiTRSettings;
