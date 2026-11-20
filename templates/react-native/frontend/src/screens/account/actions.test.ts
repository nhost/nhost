import { File } from 'expo-file-system';
import { AUTH_UNAVAILABLE, SIGNED_OUT } from '@/lib/nhost/errors';
import { readFlows } from '@/lib/nhost/links';
import {
  changeEmail,
  deleteAccount,
  listSessions,
  removeAvatar,
  resendVerification,
  signOutSession,
  updateDisplayName,
  uploadAvatar,
} from '@/screens/account/actions';
import type { AvatarFile } from '@/screens/account/avatar';

const mockClient = {
  session: null as {
    refreshTokenId?: string;
    user?: { id: string };
  } | null,
  verifiedUser: null as {
    id: string;
    email?: string;
    avatarUrl?: string;
  } | null,
  unverifiedReason: 'signed-out' as 'signed-out' | 'rejected' | 'unavailable',
  auth: {
    changeUserEmail: jest.fn(),
    sendVerificationEmail: jest.fn(),
  },
  graphql: { request: jest.fn() },
  storage: { uploadFiles: jest.fn(), deleteFile: jest.fn() },
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
    get storage() {
      return mockClient.storage;
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
  mockClient.storage.uploadFiles.mockReset();
  mockClient.storage.deleteFile.mockReset();
  mockUpdateSessionUser.mockReset();
  mockSignOut.mockReset();
  mockSignOut.mockResolvedValue({});
});

afterEach(() => {
  jest.restoreAllMocks();
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

describe('uploadAvatar', () => {
  const OLD = '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b';
  const NEW = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

  const image = (size = 10, type = 'image/png'): AvatarFile => ({
    uri: 'file:///cache/me.png',
    name: 'me.png',
    type,
    size,
  });

  // Storage cannot resize these, so they would upload and never display.
  it.each(['image/svg+xml', 'image/gif', 'image/heic'])(
    'refuses %s before uploading',
    async (type) => {
      expect((await uploadAvatar(image(10, type))).error).toBe(
        'Use a PNG, JPEG, WebP or AVIF image.',
      );
      expect(mockClient.storage.uploadFiles).not.toHaveBeenCalled();
    },
  );

  it('refuses an oversized or empty file before uploading', async () => {
    expect((await uploadAvatar(image(4 * 1024 * 1024 + 1))).error).toBe(
      'That image is over 4 MB.',
    );
    expect((await uploadAvatar(image(0))).error).toBe('Choose an image first.');
    expect(mockClient.storage.uploadFiles).not.toHaveBeenCalled();
  });

  it('stores the file, points the account at it, and drops the old one', async () => {
    mockClient.verifiedUser = {
      id: 'user-1',
      avatarUrl: `/api/avatar/${OLD}`,
    };
    mockClient.storage.uploadFiles.mockResolvedValueOnce({
      body: { processedFiles: [{ id: NEW }] },
    });
    mockClient.graphql.request.mockResolvedValueOnce({
      body: { data: { updateUser: { id: 'user-1' } } },
    });
    mockClient.storage.deleteFile.mockResolvedValueOnce({ body: undefined });

    expect(await uploadAvatar(image())).toEqual({ success: true });
    // An expo-file-system File, which Expo's fetch reads with `bytes()`.
    expect(mockClient.storage.uploadFiles).toHaveBeenCalledWith({
      'bucket-id': 'default',
      'file[]': [expect.any(File)],
    });
    expect(
      mockClient.storage.uploadFiles.mock.calls[0]?.[0]['file[]'][0].uri,
    ).toBe('file:///cache/me.png');
    expect(mockClient.graphql.request.mock.calls[0]?.[0]).toMatchObject({
      variables: { id: 'user-1', avatarUrl: `/api/avatar/${NEW}` },
    });
    expect(mockClient.storage.deleteFile).toHaveBeenCalledWith(OLD);
    expect(mockClient.storage.deleteFile).not.toHaveBeenCalledWith(NEW);
    expect(mockUpdateSessionUser).toHaveBeenCalledWith({
      avatarUrl: `/api/avatar/${NEW}`,
    });
  });

  // The upload lands before the account is pointed at it, so a failed update
  // would otherwise leave a file nothing refers to.
  it('deletes the new file when the account cannot point at it', async () => {
    mockClient.storage.uploadFiles.mockResolvedValueOnce({
      body: { processedFiles: [{ id: NEW }] },
    });
    mockClient.graphql.request.mockResolvedValueOnce({
      body: { data: { updateUser: null } },
    });
    mockClient.storage.deleteFile.mockResolvedValueOnce({ body: undefined });

    expect((await uploadAvatar(image())).error).toBe(
      'The backend did not update this account.',
    );
    expect(mockClient.storage.deleteFile).toHaveBeenCalledWith(NEW);
    expect(mockUpdateSessionUser).not.toHaveBeenCalled();
  });

  // avatar_url is the user's to set, so it may name a file this app did not
  // upload, or no file at all.
  it('leaves a previous avatar it did not write alone', async () => {
    mockClient.verifiedUser = {
      id: 'user-1',
      avatarUrl: 'https://www.gravatar.com/avatar/abc?d=blank',
    };
    mockClient.storage.uploadFiles.mockResolvedValueOnce({
      body: { processedFiles: [{ id: NEW }] },
    });
    mockClient.graphql.request.mockResolvedValueOnce({
      body: { data: { updateUser: { id: 'user-1' } } },
    });

    expect(await uploadAvatar(image())).toEqual({ success: true });
    expect(mockClient.storage.deleteFile).not.toHaveBeenCalled();
  });
});

describe('removeAvatar', () => {
  const MINE = '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b';

  beforeEach(() => {
    mockClient.verifiedUser = {
      id: 'user-1',
      avatarUrl: `/api/avatar/${MINE}`,
    };
  });

  it('clears the account first, then deletes the file', async () => {
    mockClient.graphql.request.mockResolvedValueOnce({
      body: { data: { updateUser: { id: 'user-1' } } },
    });
    mockClient.storage.deleteFile.mockResolvedValueOnce({ body: undefined });

    expect(await removeAvatar()).toEqual({ success: true });
    expect(mockClient.graphql.request.mock.calls[0]?.[0]).toMatchObject({
      variables: { id: 'user-1', avatarUrl: '' },
    });
    expect(mockClient.storage.deleteFile).toHaveBeenCalledWith(MINE);
    expect(mockClient.graphql.request.mock.invocationCallOrder[0]).toBeLessThan(
      mockClient.storage.deleteFile.mock.invocationCallOrder[0] ?? 0,
    );
    expect(mockUpdateSessionUser).toHaveBeenCalledWith({ avatarUrl: '' });
  });

  it('keeps the file when the account still points at it', async () => {
    mockClient.graphql.request.mockResolvedValueOnce({
      body: { data: { updateUser: null } },
    });

    expect((await removeAvatar()).error).toBe(
      'The backend did not update this account.',
    );
    expect(mockClient.storage.deleteFile).not.toHaveBeenCalled();
  });
});

describe('deleteAccount', () => {
  const MINE = '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b';

  const deleted = () => ({
    body: { data: { deleteUser: { id: 'user-1' } } },
  });

  it('deletes the verified user, then signs out', async () => {
    mockClient.graphql.request.mockResolvedValueOnce(deleted());

    expect(await deleteAccount()).toEqual({ success: true });
    expect(mockClient.graphql.request.mock.calls[0]?.[0]).toMatchObject({
      variables: { id: 'user-1' },
    });
    expect(mockClient.storage.deleteFile).not.toHaveBeenCalled();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  // The row cascades through the auth schema but not into storage, and once
  // it is gone there is no session left to delete the file with.
  it('deletes the avatar before the row it hangs off, then signs out', async () => {
    mockClient.verifiedUser = {
      id: 'user-1',
      avatarUrl: `/api/avatar/${MINE}`,
    };
    mockClient.storage.deleteFile.mockResolvedValueOnce({ body: undefined });
    mockClient.graphql.request.mockResolvedValueOnce(deleted());

    expect(await deleteAccount()).toEqual({ success: true });
    expect(mockClient.storage.deleteFile).toHaveBeenCalledWith(MINE);
    expect(
      mockClient.storage.deleteFile.mock.invocationCallOrder[0],
    ).toBeLessThan(mockClient.graphql.request.mock.invocationCallOrder[0] ?? 0);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('closes the account even when the avatar file cannot be deleted', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockClient.verifiedUser = {
      id: 'user-1',
      avatarUrl: `/api/avatar/${MINE}`,
    };
    mockClient.storage.deleteFile.mockRejectedValueOnce(new Error('offline'));
    mockClient.graphql.request.mockResolvedValueOnce(deleted());

    expect(await deleteAccount()).toEqual({ success: true });
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
  const actions = {
    uploadAvatar: () =>
      uploadAvatar({
        uri: 'file:///cache/me.png',
        name: 'me.png',
        type: 'image/png',
        size: 10,
      }),
    removeAvatar,
    deleteAccount,
    resendVerification,
  };

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
      expect(mockClient.storage.uploadFiles).not.toHaveBeenCalled();
      expect(mockClient.storage.deleteFile).not.toHaveBeenCalled();
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
