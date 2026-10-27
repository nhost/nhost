import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enableMfa, generateMfa } from '@/app/auth/password/mfa/actions';

const client = vi.hoisted(() => ({
  session: null as object | null,
  verifiedUser: null as { id: string; activeMfaType?: string } | null,
  auth: { changeUserMfa: vi.fn(), verifyChangeUserMfa: vi.fn() },
}));

vi.mock('@/lib/nhost/server', () => ({
  createNhostClient: async () => ({
    getUserSession: () => client.session,
    auth: client.auth,
  }),
  getVerifiedUser: async () => client.verifiedUser,
}));

beforeEach(() => {
  client.session = { accessToken: 'token' };
  client.verifiedUser = { id: 'user-1', activeMfaType: '' };
  client.auth.changeUserMfa.mockReset();
  client.auth.verifyChangeUserMfa.mockReset();
});

describe('generateMfa', () => {
  // The backend overwrites the active secret on every generate, so starting a
  // setup while two-factor is on would lock out the user's current app.
  it('refuses while two-factor is on', async () => {
    client.verifiedUser = { id: 'user-1', activeMfaType: 'totp' };

    expect(await generateMfa()).toEqual({
      error: 'Two-factor is already on. Reload the page to see its state.',
    });
    expect(client.auth.changeUserMfa).not.toHaveBeenCalled();
  });
});

describe('enableMfa', () => {
  it('activates totp with the code', async () => {
    client.auth.verifyChangeUserMfa.mockResolvedValueOnce({ body: {} });

    expect(await enableMfa('123456')).toEqual({ success: true });
    expect(client.auth.verifyChangeUserMfa).toHaveBeenCalledWith({
      code: '123456',
      activeMfaType: 'totp',
    });
  });
});
