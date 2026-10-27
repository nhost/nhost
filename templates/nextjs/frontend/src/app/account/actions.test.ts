import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  changeEmail,
  changePassword,
  deleteAccount,
  listSessions,
  removeAvatar,
  signOutSession,
  updateDisplayName,
  uploadAvatar,
} from '@/app/account/actions';
import { appOrigin } from '@/lib/nhost/env';

const client = vi.hoisted(() => ({
  session: null as {
    refreshTokenId?: string;
    user?: { id: string; email?: string; avatarUrl?: string };
  } | null,
  verifiedUser: null as {
    id: string;
    email?: string;
    avatarUrl?: string;
  } | null,
  auth: {
    changeUserPassword: vi.fn(),
    signInEmailPassword: vi.fn(),
    verifySignInMfaTotp: vi.fn(),
    changeUserEmail: vi.fn(),
    sendVerificationEmail: vi.fn(),
  },
  graphql: { request: vi.fn() },
  storage: { uploadFiles: vi.fn(), deleteFile: vi.fn() },
}));

const updateSessionUser = vi.hoisted(() => vi.fn());

vi.mock('@/lib/nhost/server', () => ({
  createNhostClient: async () => ({
    getUserSession: () => client.session,
    auth: client.auth,
    graphql: client.graphql,
    storage: client.storage,
  }),
  getVerifiedUser: async () => client.verifiedUser,
  updateSessionUser,
}));

const signOut = vi.hoisted(() => vi.fn());

vi.mock('@/lib/nhost/actions', () => ({ signOut }));

beforeEach(() => {
  client.session = { user: { id: 'user-1' } };
  client.verifiedUser = { id: 'user-1', email: 'user@example.com' };
  for (const fn of [
    ...Object.values(client.auth),
    ...Object.values(client.storage),
  ]) {
    fn.mockReset();
  }
  client.graphql.request.mockReset();
  updateSessionUser.mockReset();
  signOut.mockReset();
  signOut.mockResolvedValue({});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('changePassword', () => {
  // The change revoked this session with the rest, so the new password signs
  // this browser straight back in.
  it('signs this device back in with the new password', async () => {
    client.session = { user: { id: 'user-1', email: 'user@example.com' } };
    client.auth.changeUserPassword.mockResolvedValueOnce({ body: {} });
    client.auth.signInEmailPassword.mockResolvedValueOnce({
      body: { session: { accessToken: 'new' } },
    });

    expect(await changePassword('correct horse')).toEqual({
      success: true,
      signedIn: true,
    });
    expect(client.auth.signInEmailPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'correct horse',
    });
  });

  it('signs a two-factor account back in with the code it was given', async () => {
    client.session = { user: { id: 'user-1', email: 'user@example.com' } };
    client.auth.changeUserPassword.mockResolvedValueOnce({ body: {} });
    client.auth.signInEmailPassword.mockResolvedValueOnce({
      body: { mfa: { ticket: 'mfaTotp:abc' } },
    });
    client.auth.verifySignInMfaTotp.mockResolvedValueOnce({
      body: { session: { accessToken: 'new' } },
    });

    expect(await changePassword('correct horse', '123456')).toEqual({
      success: true,
      signedIn: true,
    });
    expect(client.auth.verifySignInMfaTotp).toHaveBeenCalledWith({
      ticket: 'mfaTotp:abc',
      otp: '123456',
    });
  });
});

describe('changeEmail', () => {
  // The link lands on the account page, on this origin, whatever the caller
  // sent: the redirect is not taken from the arguments at all.
  it('sends the confirmation link back to the account page', async () => {
    client.auth.changeUserEmail.mockResolvedValueOnce({ body: {} });

    expect(await changeEmail('new@example.com')).toEqual({ success: true });
    expect(client.auth.changeUserEmail).toHaveBeenCalledWith({
      newEmail: 'new@example.com',
      options: { redirectTo: `${appOrigin()}/account` },
    });
  });
});

describe('updateDisplayName', () => {
  it('updates the session user by id', async () => {
    client.graphql.request.mockResolvedValueOnce({
      body: { data: { updateUser: { id: 'user-1' } } },
    });

    expect(await updateDisplayName('  Ada  ')).toEqual({ success: true });
    expect(client.graphql.request.mock.calls[0]?.[0]).toMatchObject({
      variables: { id: 'user-1', displayName: 'Ada' },
    });
  });
});

describe('uploadAvatar', () => {
  const OLD = '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b';
  const NEW = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

  const image = (size = 10, type = 'image/png'): FormData => {
    const form = new FormData();
    form.set('avatar', new File([new Uint8Array(size)], 'me.png', { type }));
    return form;
  };

  // SVG can carry script, and the route handler serves the file on this
  // app's origin.
  it('refuses an SVG before uploading', async () => {
    expect((await uploadAvatar(image(10, 'image/svg+xml'))).error).toBe(
      'Use a PNG, JPEG, GIF, WebP or AVIF image.',
    );
    expect(client.storage.uploadFiles).not.toHaveBeenCalled();
  });

  it('stores the file, points the account at the route handler, and drops the old one', async () => {
    client.verifiedUser = { id: 'user-1', avatarUrl: `/api/avatar/${OLD}` };
    client.storage.uploadFiles.mockResolvedValueOnce({
      body: { processedFiles: [{ id: NEW }] },
    });
    client.graphql.request.mockResolvedValueOnce({
      body: { data: { updateUser: { id: 'user-1' } } },
    });
    client.storage.deleteFile.mockResolvedValueOnce({ body: undefined });

    expect(await uploadAvatar(image())).toEqual({ success: true });
    expect(client.storage.uploadFiles.mock.calls[0]?.[0]).toMatchObject({
      'bucket-id': 'default',
    });
    expect(client.graphql.request.mock.calls[0]?.[0]).toMatchObject({
      variables: { id: 'user-1', avatarUrl: `/api/avatar/${NEW}` },
    });
    expect(client.storage.deleteFile).toHaveBeenCalledWith(OLD);
    expect(client.storage.deleteFile).not.toHaveBeenCalledWith(NEW);
    expect(updateSessionUser).toHaveBeenCalledWith(expect.anything(), {
      avatarUrl: `/api/avatar/${NEW}`,
    });
  });

  // The upload lands before the account is pointed at it, so a failed update
  // would otherwise leave a file nothing refers to.
});

describe('removeAvatar', () => {
  const MINE = '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b';

  beforeEach(() => {
    client.verifiedUser = { id: 'user-1', avatarUrl: `/api/avatar/${MINE}` };
  });

  it('clears the account first, then deletes the file', async () => {
    client.graphql.request.mockResolvedValueOnce({
      body: { data: { updateUser: { id: 'user-1' } } },
    });
    client.storage.deleteFile.mockResolvedValueOnce({ body: undefined });

    expect(await removeAvatar()).toEqual({ success: true });
    expect(client.graphql.request.mock.calls[0]?.[0]).toMatchObject({
      variables: { id: 'user-1', avatarUrl: '' },
    });
    expect(client.storage.deleteFile).toHaveBeenCalledWith(MINE);
    expect(updateSessionUser).toHaveBeenCalledWith(expect.anything(), {
      avatarUrl: '',
    });
  });
});

describe('deleteAccount', () => {
  const MINE = '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b';

  const deleted = () => ({
    body: { data: { deleteUser: { id: 'user-1' } } },
  });

  // The row cascades through the auth schema but not into storage, and once
  // it is gone there is no session left to delete the file with.
  it('deletes the avatar before the row it hangs off', async () => {
    client.verifiedUser = { id: 'user-1', avatarUrl: `/api/avatar/${MINE}` };
    client.storage.deleteFile.mockResolvedValueOnce({ body: undefined });
    client.graphql.request.mockResolvedValueOnce(deleted());

    expect(await deleteAccount()).toEqual({ success: true });
    expect(client.storage.deleteFile).toHaveBeenCalledWith(MINE);
    expect(client.storage.deleteFile.mock.invocationCallOrder[0]).toBeLessThan(
      client.graphql.request.mock.invocationCallOrder[0] ?? 0,
    );
  });
});

describe('listSessions', () => {
  beforeEach(() => {
    client.session = { refreshTokenId: 'this-one', user: { id: 'user-1' } };
  });

  it('marks the session in use', async () => {
    client.graphql.request.mockResolvedValueOnce({
      body: {
        data: {
          authRefreshTokens: [
            { id: 'other', createdAt: '2026-10-01T00:00:00Z', metadata: null },
            {
              id: 'this-one',
              createdAt: '2026-10-02T00:00:00Z',
              metadata: null,
            },
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
    client.session = { refreshTokenId: 'this-one', user: { id: 'user-1' } };
  });

  // Deleting the row under this browser would leave it holding cookies for a
  // session that no longer exists.
  it('refuses the session in use', async () => {
    expect((await signOutSession('this-one')).error).toContain(
      'Sign out from the menu',
    );
    expect(client.graphql.request).not.toHaveBeenCalled();
  });
});
