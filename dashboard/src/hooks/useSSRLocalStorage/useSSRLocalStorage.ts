import { useCallback, useEffect, useState } from 'react';

function useSSRLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error('Error reading localStorage:', error);
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T) => {
      try {
        const valueToStore =
          value instanceof Function ? value(storedValue) : value;

        // Update localStorage
        window.localStorage.setItem(key, JSON.stringify(valueToStore));

        // Dispatch storage event manually
        window.dispatchEvent(
          new StorageEvent('storage', {
            key,
            newValue: JSON.stringify(valueToStore),
            storageArea: window.localStorage,
          }),
        );

        // Update local state
        setStoredValue(valueToStore);
      } catch (error) {
        console.error('Error saving to localStorage:', error);
      }
    },
    [key, storedValue],
  );

  const removeValue = useCallback(() => {
    try {
      const oldValue = window.localStorage.getItem(key);
      window.localStorage.removeItem(key);
      window.dispatchEvent(
        new StorageEvent('storage', {
          key,
          newValue: null,
          oldValue,
          storageArea: window.localStorage,
        }),
      );
      setStoredValue(initialValue);
    } catch (error) {
      console.error('Error removing from localStorage:', error);
    }
  }, [initialValue, key]);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.storageArea === window.localStorage && event.key === key) {
        setStoredValue(
          event.newValue ? JSON.parse(event.newValue) : initialValue,
        );
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue] as const;
}

export default useSSRLocalStorage;
