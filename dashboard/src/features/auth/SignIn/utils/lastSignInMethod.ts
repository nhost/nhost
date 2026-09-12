import { useEffect, useState } from 'react';

export type LastSignInMethod = 'github' | 'security-key' | 'email';

export const LAST_SIGN_IN_METHOD_STORAGE_KEY = 'nhost_last_signin_method';

const VALID_SIGN_IN_METHODS: ReadonlySet<string> = new Set([
  'github',
  'security-key',
  'email',
]);

/**
 * Persists the last successful sign-in method to localStorage.
 */
export function saveLastSignInMethod(method: LastSignInMethod): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LAST_SIGN_IN_METHOD_STORAGE_KEY, method);
    }
  } catch (error) {
    console.error('Failed to save last sign-in method to localStorage:', error);
  }
}

/**
 * Retrieves the last successful sign-in method from localStorage.
 */
export function getLastSignInMethod(): LastSignInMethod | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedMethod = window.localStorage.getItem(
        LAST_SIGN_IN_METHOD_STORAGE_KEY,
      );
      if (storedMethod && VALID_SIGN_IN_METHODS.has(storedMethod)) {
        return storedMethod as LastSignInMethod;
      }
    }
  } catch (error) {
    console.error(
      'Failed to get last sign-in method from localStorage:',
      error,
    );
  }
  return null;
}

/**
 * Clears the last successful sign-in method from localStorage.
 */
export function clearLastSignInMethod(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(LAST_SIGN_IN_METHOD_STORAGE_KEY);
    }
  } catch (error) {
    console.error(
      'Failed to clear last sign-in method from localStorage:',
      error,
    );
  }
}

/**
 * Hydration-safe React hook to retrieve the last used sign-in method.
 * Returns null initially to match SSR HTML, then updates on mount.
 */
export function useLastSignInMethod(): LastSignInMethod | null {
  const [lastSignInMethod, setLastSignInMethod] =
    useState<LastSignInMethod | null>(null);

  useEffect(() => {
    setLastSignInMethod(getLastSignInMethod());
  }, []);

  return lastSignInMethod;
}
