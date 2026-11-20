import { AUTH_UNAVAILABLE, SIGNED_OUT } from '@/lib/nhost/errors';
import { readFlows } from '@/lib/nhost/links';
import {
  changeEmail,
  deleteAccount,
  listSessions,
  resendVerification,
  signOutSession,
  updateDisplayName,
} from '@/screens/account/actions';

const mockClient = {
  session: null as {
    refreshTokenId?: string;
    user?: { id: string };
  } | null,
  verifiedUser: null as { id: string; email?: string } | null,
  unverifiedReason: 'signed-out' as 'signed-out' | 'rejected' | 'unavailable',
  auth: {
    changeUserEmail: jest.fn(),
    sendVerificationEmail: jest.fn(),
  },
  graphql: { request: jest.fn() },
};

const mockUpdateSessionUser = jest.fn();
const mockSignOut = jest.fn();

jest.mock('@/lib/nhost/client', () => ({
  LINK_TYPE_PARAM: 'type',
  // Read when called: the factory runs before `mockClient` is assigned.
  nhost: {
    getUserSession: () => mockClient.session,
    get auth() {
      return mockClient.auth;
    },
    get graphql() {
      return mockClient.graphql;
    },
  },
  getVerifiedUser: async () =>
    mockClient.verifiedUser
      ? { user: mockClient.verifiedUser }
      : { user: null, reason: mockClient.unverifiedReason },
  updateSessionUser: (patch: unknown) => mockUpdateSessionUser(patch),
}));

jest.mock('@/lib/nhost/actions', () => ({ signOut: () => mockSignOut() }));

beforeEach(() => {
  mockClient.session = { user: { id: 'user-1' } };
  mockClient.verifiedUser = { id: 'user-1', email: 'user@example.com' };
  mockClient.unverifiedReason = 'signed-out';
  mockClient.auth.changeUserEmail.mockReset();
  mockClient.auth.sendVerificationEmail.mockReset();
  mockClient.graphql.request.mockReset();
  mockUpdateSessionUser.mockReset();
  mockSignOut.mockReset();
  mockSignOut.mockResolvedValue({});
});

// The link lands on the account screen, whatever the caller sent, carrying a
// PKCE flow: a code that comes back while this user is signed in is
// discarded, and one opened elsewhere signs nobody in.
const ACCOUNT_LINK = /^nhost-starter:\/\/account\?flow=([A-Za-z0-9_-]{22})$/;

describe('changeEmail', () => {
  it('sends the confirmation link back to the account screen with a challenge', async () => {
    mockClient.auth.changeUserEmail.mockResolvedValueOnce({ body: {} });

    expect(await changeEmail('new@example.com')).toEqual({ success: true });

    const [[request]] = mockClient.auth.changeUserEmail.mock.calls;
    expect(request).toEqual({
      newEmail: 'new@example.com',
      options: { redirectTo: expect.stringMatching(ACCOUNT_LINK) },
      codeChallenge: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    });
    const flow = ACCOUNT_LINK.exec(request.options.redirectTo)?.[1];
    expect(readFlows()).toContainEqual(
      expect.objectContaining({ id: flow, kind: 'emailChange' }),
    );
  });

  it('asks a signed-out user to sign in, and sends nothing', async () => {
    mockClient.session = null;

    expect(await changeEmail('new@example.com')).toEqual({
      error: SIGNED_OUT,
    });
    expect(mockClient.auth.changeUserEmail).not.toHaveBeenCalled();
  });

  it('names the email rate limit', async () => {
    mockClient.auth.changeUserEmail.mockRejectedValueOnce({
      status: 429,
      message: '',
    });

    expect((await changeEmail('new@example.com')).error).toBe(
      'Could not start the email change: Too many attempts. Try again in an hour.',
    );
  });
});

describe('resendVerification', () => {
  it('sends the link for the verified user back to the account screen with a challenge', async () => {
    mockClient.auth.sendVerificationEmail.mockResolvedValueOnce({ body: 'OK' });

    expect(await resendVerification()).toEqual({ success: true });

    const [[request]] = mockClient.auth.sendVerificationEmail.mock.calls;
    expect(request).toEqual({
      email: 'user@example.com',
      options: { redirectTo: expect.stringMatching(ACCOUNT_LINK) },
      codeChallenge: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    });
    const flow = ACCOUNT_LINK.exec(request.options.redirectTo)?.[1];
    expect(readFlows()).toContainEqual(
      expect.objectContaining({ id: flow, kind: 'emailVerify' }),
    );
  });
});

describe('updateDisplayName', () => {
  it('updates the session user by id', async () => {
    mockClient.graphql.request.mockResolvedValueOnce({
      body: { data: { updateUser: { id: 'user-1' } } },
    });

    expect(await updateDisplayName('  Ada  ')).toEqual({ success: true });
    expect(mockClient.graphql.request.mock.calls[0]?.[0]).toMatchObject({
      variables: { id: 'user-1', displayName: 'Ada' },
    });
    expect(mockUpdateSessionUser).toHaveBeenCalledWith({ displayName: 'Ada' });
  });

  it('refuses a blank name before asking the backend', async () => {
    expect(await updateDisplayName('   ')).toEqual({
      error: 'A display name is required.',
    });
    expect(mockClient.graphql.request).not.toHaveBeenCalled();
  });

  it('keeps the stored user when the backend updated nothing', async () => {
    mockClient.graphql.request.mockResolvedValueOnce({
      body: { data: { updateUser: null } },
    });

    expect((await updateDisplayName('Ada')).error).toBe(
      'The backend did not update this account.',
    );
    expect(mockUpdateSessionUser).not.toHaveBeenCalled();
  });
});

describe('deleteAccount', () => {
  it('deletes the verified user, then signs out', async () => {
    mockClient.graphql.request.mockResolvedValueOnce({
      body: { data: { deleteUser: { id: 'user-1' } } },
    });

    expect(await deleteAccount()).toEqual({ success: true });
    expect(mockClient.graphql.request.mock.calls[0]?.[0]).toMatchObject({
      variables: { id: 'user-1' },
    });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('stays signed in when the backend deleted nothing', async () => {
    mockClient.graphql.request.mockResolvedValueOnce({
      body: { data: { deleteUser: null } },
    });

    expect((await deleteAccount()).error).toBe(
      'The backend did not delete this account.',
    );
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});

describe('the actions that verify the user', () => {
  const actions = { deleteAccount, resendVerification };

  beforeEach(() => {
    mockClient.verifiedUser = null;
  });

  // An outage or a rate limit leaves the stored session as it was, so sending
  // the user to sign in again would be the wrong advice.
  it.each(Object.entries(actions))(
    '%s does not call an unreachable auth service a sign-out',
    async (_, action) => {
      mockClient.unverifiedReason = 'unavailable';

      expect(await action()).toEqual({ error: AUTH_UNAVAILABLE });
      expect(mockClient.graphql.request).not.toHaveBeenCalled();
      expect(mockClient.auth.sendVerificationEmail).not.toHaveBeenCalled();
      expect(mockSignOut).not.toHaveBeenCalled();
    },
  );

  it.each(['signed-out', 'rejected'] as const)(
    'asks the user to sign in again when %s',
    async (reason) => {
      mockClient.unverifiedReason = reason;

      for (const action of Object.values(actions)) {
        expect(await action()).toEqual({ error: SIGNED_OUT });
      }
      expect(mockClient.graphql.request).not.toHaveBeenCalled();
    },
  );
});

describe('listSessions', () => {
  beforeEach(() => {
    mockClient.session = {
      refreshTokenId: 'this-one',
      user: { id: 'user-1' },
    };
  });

  it('marks the session in use', async () => {
    mockClient.graphql.request.mockResolvedValueOnce({
      body: {
        data: {
          authRefreshTokens: [
            { id: 'other', createdAt: '2026-10-01T00:00:00Z' },
            { id: 'this-one', createdAt: '2026-10-02T00:00:00Z' },
          ],
        },
      },
    });

    expect((await listSessions()).sessions).toEqual([
      expect.objectContaining({ id: 'other', current: false }),
      expect.objectContaining({ id: 'this-one', current: true }),
    ]);
  });
});

describe('signOutSession', () => {
  beforeEach(() => {
    mockClient.session = {
      refreshTokenId: 'this-one',
      user: { id: 'user-1' },
    };
  });

  // Deleting the row under this device would leave it holding a stored
  // session that no longer exists.
  it('refuses the session in use', async () => {
    expect((await signOutSession('this-one')).error).toContain(
      'Sign out from the menu',
    );
    expect(mockClient.graphql.request).not.toHaveBeenCalled();
  });

  it('deletes another session by id', async () => {
    mockClient.graphql.request.mockResolvedValueOnce({
      body: { data: { deleteAuthRefreshToken: { id: 'other' } } },
    });

    expect(await signOutSession('other')).toEqual({ success: true });
    expect(mockClient.graphql.request.mock.calls[0]?.[0]).toMatchObject({
      variables: { id: 'other' },
    });
  });

  it('says so when the session is not on this account', async () => {
    mockClient.graphql.request.mockResolvedValueOnce({
      body: { data: { deleteAuthRefreshToken: null } },
    });

    expect((await signOutSession('someone-else')).error).toBe(
      'That session is not on this account.',
    );
  });
});
