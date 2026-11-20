import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/nhost/AuthProvider';

/**
 * What `load` last resolved to, or undefined until it first does. Loads on
 * mount and again whenever `useRefresh()` is called; an answer that arrives
 * after a newer load started is dropped.
 */
export function useLoad<T>(load: () => Promise<T>): T | undefined {
  const { load: key } = useAuth();
  const [value, setValue] = useState<T>();
  const latest = useRef(load);
  useEffect(() => {
    latest.current = load;
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: the key is the trigger, not an input
  useEffect(() => {
    let current = true;
    latest.current().then(
      (loaded) => {
        if (current) {
          setValue(() => loaded);
        }
      },
      (err: unknown) => console.error('Could not load the screen:', err),
    );
    return () => {
      current = false;
    };
  }, [key]);

  return value;
}
