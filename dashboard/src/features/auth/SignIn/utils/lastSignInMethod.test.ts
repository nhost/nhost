import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@/tests/testUtils';
import {
  clearLastSignInMethod,
  getLastSignInMethod,
  LAST_SIGN_IN_METHOD_STORAGE_KEY,
  saveLastSignInMethod,
  useLastSignInMethod,
} from './lastSignInMethod';

describe('lastSignInMethod utilities', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('saveLastSignInMethod', () => {
    it('should save github to localStorage', () => {
      saveLastSignInMethod('github');
      expect(window.localStorage.getItem(LAST_SIGN_IN_METHOD_STORAGE_KEY)).toBe(
        'github',
      );
    });

    it('should save security-key to localStorage', () => {
      saveLastSignInMethod('security-key');
      expect(window.localStorage.getItem(LAST_SIGN_IN_METHOD_STORAGE_KEY)).toBe(
        'security-key',
      );
    });

    it('should save email to localStorage', () => {
      saveLastSignInMethod('email');
      expect(window.localStorage.getItem(LAST_SIGN_IN_METHOD_STORAGE_KEY)).toBe(
        'email',
      );
    });

    it('should handle localStorage.setItem errors gracefully without throwing', () => {
      vi.spyOn(window.localStorage, 'setItem').mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      expect(() => saveLastSignInMethod('github')).not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('getLastSignInMethod', () => {
    it('should return null when nothing is stored', () => {
      expect(getLastSignInMethod()).toBeNull();
    });

    it('should return github when github is stored', () => {
      window.localStorage.setItem(LAST_SIGN_IN_METHOD_STORAGE_KEY, 'github');
      expect(getLastSignInMethod()).toBe('github');
    });

    it('should return security-key when security-key is stored', () => {
      window.localStorage.setItem(
        LAST_SIGN_IN_METHOD_STORAGE_KEY,
        'security-key',
      );
      expect(getLastSignInMethod()).toBe('security-key');
    });

    it('should return email when email is stored', () => {
      window.localStorage.setItem(LAST_SIGN_IN_METHOD_STORAGE_KEY, 'email');
      expect(getLastSignInMethod()).toBe('email');
    });

    it('should return null when invalid method is stored', () => {
      window.localStorage.setItem(
        LAST_SIGN_IN_METHOD_STORAGE_KEY,
        'unsupported_method',
      );
      expect(getLastSignInMethod()).toBeNull();
    });

    it('should handle localStorage.getItem errors gracefully without throwing', () => {
      vi.spyOn(window.localStorage, 'getItem').mockImplementationOnce(() => {
        throw new Error('SecurityError');
      });
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      expect(getLastSignInMethod()).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('clearLastSignInMethod', () => {
    it('should remove the key from localStorage', () => {
      window.localStorage.setItem(LAST_SIGN_IN_METHOD_STORAGE_KEY, 'github');
      clearLastSignInMethod();
      expect(
        window.localStorage.getItem(LAST_SIGN_IN_METHOD_STORAGE_KEY),
      ).toBeNull();
    });

    it('should handle localStorage.removeItem errors gracefully without throwing', () => {
      vi.spyOn(window.localStorage, 'removeItem').mockImplementationOnce(() => {
        throw new Error('SecurityError');
      });
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      expect(() => clearLastSignInMethod()).not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('useLastSignInMethod hook', () => {
    it('should return null initially if nothing stored', () => {
      const { result } = renderHook(() => useLastSignInMethod());
      expect(result.current).toBeNull();
    });

    it('should return stored method after mount', () => {
      window.localStorage.setItem(LAST_SIGN_IN_METHOD_STORAGE_KEY, 'github');
      const { result } = renderHook(() => useLastSignInMethod());
      expect(result.current).toBe('github');
    });
  });
});
