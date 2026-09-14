import { useEffect, useState } from 'react';

const SIGN_IN_METHODS = ['github', 'security-key', 'email'] as const;

export type LastSignInMethod = (typeof SIGN_IN_METHODS)[number];

export const LAST_SIGN_IN_METHOD_STORAGE_KEY = 'nhost_last_signin_method';

function isLastSignInMethod(value: string | null): value is LastSignInMethod {
  return SIGN_IN_METHODS.includes(value as LastSignInMethod);
}

/**
 * Persists the last successful sign-in method to localStorage.
 */
export function saveLastSignInMethod(method: LastSignInMethod): void {
  try {
    localStorage.setItem(LAST_SIGN_IN_METHOD_STORAGE_KEY, method);
  } catch (error) {
    console.error('Failed to save last sign-in method to localStorage:', error);
  }
}

/**
 * Retrieves the last successful sign-in method from localStorage.
 */
export function getLastSignInMethod(): LastSignInMethod | null {
  try {
    const storedMethod = localStorage.getItem(LAST_SIGN_IN_METHOD_STORAGE_KEY);
    if (isLastSignInMethod(storedMethod)) {
      return storedMethod;
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
 * Reads storage after mount so the first client render matches the prerendered
 * HTML, which has no access to localStorage.
 */
export function useLastSignInMethod(): LastSignInMethod | null {
  const [lastSignInMethod, setLastSignInMethod] =
    useState<LastSignInMethod | null>(null);

  useEffect(() => {
    setLastSignInMethod(getLastSignInMethod());
  }, []);

  return lastSignInMethod;
}
