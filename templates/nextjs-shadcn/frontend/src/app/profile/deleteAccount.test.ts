import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteAccount } from '@/app/profile/actions';
import { gqlRequest } from '@/lib/graphql';
import { createNhostClient } from '@/lib/nhost/server';

vi.mock('@/lib/nhost/server', () => ({
  createNhostClient: vi.fn(),
}));

vi.mock('@/lib/graphql', () => ({ gqlRequest: vi.fn() }));

const USER = 'user-id';
const REFRESH_TOKEN = 'refresh-token';

const signOut = vi.fn();
const clearSession = vi.fn();

const client = {
  getUserSession: () => ({
    user: { id: USER },
    refreshToken: REFRESH_TOKEN,
  }),
  auth: { signOut },
  clearSession,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createNhostClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createNhostClient>>,
  );
  vi.mocked(gqlRequest).mockResolvedValue({
    user: { id: USER, metadata: {} },
  } as never);
});

describe('deleteAccount sign-out outcome', () => {
  it('reports plain success once the account is stamped and every device signed out', async () => {
    signOut.mockResolvedValue({});

    const result = await deleteAccount();

    expect(result).toEqual({ success: true });
    expect(signOut).toHaveBeenCalledWith({
      refreshToken: REFRESH_TOKEN,
      all: true,
    });
    expect(clearSession).not.toHaveBeenCalled();
  });

  // The stamp write already succeeded by the time signOut runs, so this
  // device holding a session for a deleted account - not a report of total
  // failure - is the actual risk: the session cookie's own metadata copy
  // stays stale until the next token refresh, so leaving it in place would
  // keep this device acting as signed in. clearSession() is what closes that,
  // independently of whether the backend call above succeeded.
  it('clears the local session and reports the device as signed out when signOut fails', async () => {
    signOut.mockRejectedValue(new Error('network blip'));

    const result = await deleteAccount();

    expect(result).toEqual({
      success: true,
      error:
        'Your account is marked deleted, and this device has been signed out. Sign in again within 30 days to restore it.',
    });
    expect(clearSession).toHaveBeenCalledOnce();
  });
});
