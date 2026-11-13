import { vi } from 'vitest';
import { act, renderHook } from '@/tests/testUtils';
import useDefaultOrganization, {
  getDefaultOrganizationStorageKey,
} from './useDefaultOrganization';

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

vi.mock('@/providers/Auth', () => ({
  useAuth: mocks.useAuth,
}));

const USER_ID = 'user-1';
const OTHER_USER_ID = 'user-2';
const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';

function signInAs(userId: string | undefined) {
  mocks.useAuth.mockReturnValue({ user: userId ? { id: userId } : null });
}

describe('useDefaultOrganization', () => {
  beforeEach(() => {
    localStorage.clear();
    signInAs(USER_ID);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is not ready and has no default without a user', () => {
    signInAs(undefined);

    const { result } = renderHook(() => useDefaultOrganization());

    expect(result.current.isReady).toBe(false);
    expect(result.current.defaultOrgId).toBeNull();
    expect(() => result.current.setDefaultOrgId(ORG_A)).toThrow();
  });

  it('reads the stored default for the signed in user only', () => {
    localStorage.setItem(
      getDefaultOrganizationStorageKey(OTHER_USER_ID),
      ORG_B,
    );
    localStorage.setItem(getDefaultOrganizationStorageKey(USER_ID), ORG_A);

    const { result, rerender } = renderHook(() => useDefaultOrganization());

    expect(result.current.isReady).toBe(true);
    expect(result.current.defaultOrgId).toBe(ORG_A);

    signInAs(OTHER_USER_ID);
    rerender();

    expect(result.current.defaultOrgId).toBe(ORG_B);
  });

  it('ignores a stored value that is not an organization ID', () => {
    localStorage.setItem(getDefaultOrganizationStorageKey(USER_ID), 'nope');

    const { result } = renderHook(() => useDefaultOrganization());

    expect(result.current.defaultOrgId).toBeNull();
  });

  it('sets and clears the default and keeps other hooks in sync', () => {
    const first = renderHook(() => useDefaultOrganization());
    const second = renderHook(() => useDefaultOrganization());

    act(() => first.result.current.setDefaultOrgId(ORG_A));

    expect(
      localStorage.getItem(getDefaultOrganizationStorageKey(USER_ID)),
    ).toBe(ORG_A);
    expect(second.result.current.defaultOrgId).toBe(ORG_A);

    act(() => second.result.current.clearDefaultOrg());

    expect(first.result.current.defaultOrgId).toBeNull();
  });

  it('follows changes made in another tab', () => {
    const { result } = renderHook(() => useDefaultOrganization());

    act(() => {
      localStorage.setItem(getDefaultOrganizationStorageKey(USER_ID), ORG_B);
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: getDefaultOrganizationStorageKey(USER_ID),
          storageArea: localStorage,
        }),
      );
    });

    expect(result.current.defaultOrgId).toBe(ORG_B);

    act(() => {
      localStorage.clear();
      window.dispatchEvent(
        new StorageEvent('storage', { key: null, storageArea: localStorage }),
      );
    });

    expect(result.current.defaultOrgId).toBeNull();
  });

  it('rejects an invalid organization ID', () => {
    const { result } = renderHook(() => useDefaultOrganization());

    expect(() => result.current.setDefaultOrgId('not-an-id')).toThrow();
    expect(
      localStorage.getItem(getDefaultOrganizationStorageKey(USER_ID)),
    ).toBeNull();
  });

  it('throws when storage cannot be written', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    const { result } = renderHook(() => useDefaultOrganization());

    expect(() => result.current.setDefaultOrgId(ORG_A)).toThrow(
      'QuotaExceededError',
    );
    expect(result.current.defaultOrgId).toBeNull();
  });

  it('reads no default when storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useDefaultOrganization());

    expect(result.current.isReady).toBe(true);
    expect(result.current.defaultOrgId).toBeNull();
  });
});
