import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  disableMfa,
  enableMfa,
  generateMfa,
} from '@/app/auth/password/mfa/actions';

const client = vi.hoisted(() => ({
  session: null as object | null,
  auth: { changeUserMfa: vi.fn(), verifyChangeUserMfa: vi.fn() },
}));

vi.mock('@/lib/nhost/server', () => ({
  createNhostClient: async () => ({
    getUserSession: () => client.session,
    auth: client.auth,
  }),
}));

beforeEach(() => {
  client.session = { accessToken: 'token' };
  client.auth.changeUserMfa.mockReset();
  client.auth.verifyChangeUserMfa.mockReset();
});

describe('generateMfa', () => {
  it('hands back the QR code and the secret', async () => {
    client.auth.changeUserMfa.mockResolvedValueOnce({
      body: { imageUrl: 'data:image/png;base64,abc', totpSecret: 'SECRET' },
    });

    expect(await generateMfa()).toEqual({
      setup: { imageUrl: 'data:image/png;base64,abc', totpSecret: 'SECRET' },
    });
  });

  it('refuses without a session', async () => {
    client.session = null;

    expect(await generateMfa()).toEqual({
      error: 'You are signed out. Sign in and try again.',
    });
    expect(client.auth.changeUserMfa).not.toHaveBeenCalled();
  });
});

describe('enableMfa', () => {
  it('asks for a code before calling the backend', async () => {
    expect(await enableMfa('')).toEqual({
      error: 'Enter the code from your authenticator app.',
    });
    expect(client.auth.verifyChangeUserMfa).not.toHaveBeenCalled();
  });

  it('activates totp with the code', async () => {
    client.auth.verifyChangeUserMfa.mockResolvedValueOnce({ body: {} });

    expect(await enableMfa('123456')).toEqual({ success: true });
    expect(client.auth.verifyChangeUserMfa).toHaveBeenCalledWith({
      code: '123456',
      activeMfaType: 'totp',
    });
  });

  it('reports a backend error instead of throwing', async () => {
    client.auth.verifyChangeUserMfa.mockRejectedValueOnce(
      new Error('invalid code'),
    );

    expect(await enableMfa('000000')).toEqual({
      error: 'Could not turn on two-factor: invalid code',
    });
  });
});

describe('disableMfa', () => {
  // A current code is required to turn it off, so the action never sends
  // the deactivation without one.
  it('asks for a code before calling the backend', async () => {
    expect(await disableMfa('')).toEqual({
      error: 'Enter the code from your authenticator app.',
    });
    expect(client.auth.verifyChangeUserMfa).not.toHaveBeenCalled();
  });

  it('deactivates with the code', async () => {
    client.auth.verifyChangeUserMfa.mockResolvedValueOnce({ body: {} });

    expect(await disableMfa('123456')).toEqual({ success: true });
    expect(client.auth.verifyChangeUserMfa).toHaveBeenCalledWith({
      code: '123456',
      activeMfaType: '',
    });
  });
});
