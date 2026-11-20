import { enableMfa, generateMfa } from '@/screens/auth/password/mfa/actions';

const mockClient = {
  session: null as object | null,
  verifiedUser: null as { id: string; activeMfaType?: string } | null,
  auth: { changeUserMfa: jest.fn(), verifyChangeUserMfa: jest.fn() },
};

jest.mock('@/lib/nhost/client', () => ({
  nhost: {
    getUserSession: () => mockClient.session,
    get auth() {
      return mockClient.auth;
    },
  },
  getVerifiedUser: async () => ({ user: mockClient.verifiedUser }),
}));

beforeEach(() => {
  mockClient.session = { accessToken: 'token' };
  mockClient.verifiedUser = { id: 'user-1', activeMfaType: '' };
  mockClient.auth.changeUserMfa.mockReset();
  mockClient.auth.verifyChangeUserMfa.mockReset();
});

describe('generateMfa', () => {
  // The backend overwrites the active secret on every generate, so starting a
  // setup while two-factor is on would lock out the user's current app.
  it('refuses while two-factor is on', async () => {
    mockClient.verifiedUser = { id: 'user-1', activeMfaType: 'totp' };

    expect(await generateMfa()).toEqual({
      error:
        'Two-factor is already on. Open your account again to see its state.',
    });
    expect(mockClient.auth.changeUserMfa).not.toHaveBeenCalled();
  });

  it('hands over the QR code and the key', async () => {
    mockClient.auth.changeUserMfa.mockResolvedValueOnce({
      body: { imageUrl: 'data:image/png;base64,qr', totpSecret: 'KEY' },
    });

    expect(await generateMfa()).toEqual({
      setup: { imageUrl: 'data:image/png;base64,qr', totpSecret: 'KEY' },
    });
  });
});

describe('enableMfa', () => {
  it('activates totp with the code', async () => {
    mockClient.auth.verifyChangeUserMfa.mockResolvedValueOnce({ body: {} });

    expect(await enableMfa('123456')).toEqual({ success: true });
    expect(mockClient.auth.verifyChangeUserMfa).toHaveBeenCalledWith({
      code: '123456',
      activeMfaType: 'totp',
    });
  });
});
