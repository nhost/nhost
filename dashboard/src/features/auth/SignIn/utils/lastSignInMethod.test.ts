import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@/tests/testUtils';
import {
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
    it('should save the method under the shared storage key', () => {
      saveLastSignInMethod('github');
      expect(window.localStorage.getItem('nhost_last_signin_method')).toBe(
        'github',
      );
      expect(window.localStorage.getItem(LAST_SIGN_IN_METHOD_STORAGE_KEY)).toBe(
        'github',
      );
    });

    it('should handle localStorage.setItem errors gracefully without throwing', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
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
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      expect(getLastSignInMethod()).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('useLastSignInMethod hook', () => {
    it('should return stored method after mount', () => {
      window.localStorage.setItem(LAST_SIGN_IN_METHOD_STORAGE_KEY, 'github');
      const { result } = renderHook(() => useLastSignInMethod());
      expect(result.current).toBe('github');
    });
  });
});
