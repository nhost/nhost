import hypertune from '@/hypertune/hypertune';
import { useEffect, useState } from 'react';

export default function useHypertune() {
  const [, setIsInitialized] = useState<boolean>(hypertune.isInitialized());

  useEffect(() => {
    hypertune.waitForInitialization().then(() => {
      setIsInitialized(true);
    });
  }, []);

  return hypertune;
}
