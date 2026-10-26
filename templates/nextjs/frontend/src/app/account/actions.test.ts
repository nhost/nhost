import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  changeEmail,
  changePassword,
  deleteAccount,
  listSessions,
  removeAvatar,
  resendVerification,
  signOutSession,
  updateDisplayName,
  uploadAvatar,
} from '@/app/account/actions';
import { appOrigin } from '@/lib/nhost/env';

const client = vi.hoisted(() => ({
  session: null as {
    refreshTokenId?: string;
    user?: { id: string; avatarUrl?: string };
  } | null,
  verifiedUser: null as {
    id: string;
    email?: string;
    avatarUrl?: string;
  } | null,
  auth: {
    changeUserPassword: vi.fn(),
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
  it('asks for a password before calling the backend', async () => {
    expect(await changePassword('')).toEqual({
      error: 'A new password is required.',
    });
    expect(client.auth.changeUserPassword).not.toHaveBeenCalled();
  });

  it('refuses without a session rather than calling the backend', async () => {
    client.session = null;

    expect(await changePassword('correct horse')).toEqual({
      error: 'You are signed out. Sign in and try again.',
    });
    expect(client.auth.changeUserPassword).not.toHaveBeenCalled();
  });

  // Only the new password goes to the backend: the endpoint has no field for
  // the current one.
  it('sends the new password and nothing else', async () => {
    client.auth.changeUserPassword.mockResolvedValueOnce({ body: {} });

    expect(await changePassword('correct horse')).toEqual({ success: true });
    expect(client.auth.changeUserPassword).toHaveBeenCalledWith({
      newPassword: 'correct horse',
    });
  });

  it('reports a backend error instead of throwing', async () => {
    client.auth.changeUserPassword.mockRejectedValueOnce(
      new Error('password too short'),
    );

    expect(await changePassword('short')).toEqual({
      error: 'Could not change the password: password too short',
    });
  });
});

describe('changeEmail', () => {
  it('asks for an address before calling the backend', async () => {
    expect(await changeEmail('')).toEqual({
      error: 'A new email address is required.',
    });
    expect(client.auth.changeUserEmail).not.toHaveBeenCalled();
  });

  it('refuses without a session', async () => {
    client.session = null;

    expect(await changeEmail('new@example.com')).toEqual({
      error: 'You are signed out. Sign in and try again.',
    });
    expect(client.auth.changeUserEmail).not.toHaveBeenCalled();
  });

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
  it('asks for a name before calling the backend', async () => {
    expect(await updateDisplayName('   ')).toEqual({
      error: 'A display name is required.',
    });
    expect(client.graphql.request).not.toHaveBeenCalled();
  });

  it('updates the session user by id', async () => {
    client.graphql.request.mockResolvedValueOnce({
      body: { data: { updateUser: { id: 'user-1' } } },
    });

    expect(await updateDisplayName('  Ada  ')).toEqual({ success: true });
    expect(client.graphql.request.mock.calls[0]?.[0]).toMatchObject({
      variables: { id: 'user-1', displayName: 'Ada' },
    });
  });

  // The nav shows the cookie's user, so the name there would otherwise lag
  // until the next token refresh.
  it('patches the session cookie with the new name', async () => {
    client.graphql.request.mockResolvedValueOnce({
      body: { data: { updateUser: { id: 'user-1' } } },
    });

    await updateDisplayName('  Ada  ');

    expect(updateSessionUser).toHaveBeenCalledWith(expect.anything(), {
      displayName: 'Ada',
    });
  });

  // The permission filters by the token's user, so a row that is not this
  // user's comes back null rather than erroring.
  it('reports when nothing was updated', async () => {
    client.graphql.request.mockResolvedValueOnce({
      body: { data: { updateUser: null } },
    });

    expect(await updateDisplayName('Ada')).toEqual({
      error: 'The backend did not update this account.',
    });
    expect(updateSessionUser).not.toHaveBeenCalled();
  });

  it('names the metadata when the schema lacks the mutation', async () => {
    client.graphql.request.mockResolvedValueOnce({
      body: {
        errors: [
          { message: "field 'updateUser' not found in type: 'mutation_root'" },
        ],
      },
    });

    expect((await updateDisplayName('Ada')).error).toContain('nhost/metadata');
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

  it('refuses an empty, non-image or oversized file before uploading', async () => {
    expect((await uploadAvatar(new FormData())).error).toBe(
      'Choose an image first.',
    );
    expect((await uploadAvatar(image(10, 'text/plain'))).error).toBe(
      'Use a PNG, JPEG, GIF, WebP or AVIF image.',
    );
    expect((await uploadAvatar(image(5 * 1024 * 1024 + 1))).error).toBe(
      'That image is over 5 MB.',
    );
    expect(client.storage.uploadFiles).not.toHaveBeenCalled();
  });

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

  // A fresh account's avatar is a gravatar URL, which is not a file of ours
  // to delete.
  it('leaves an avatar it did not write alone', async () => {
    client.verifiedUser = {
      id: 'user-1',
      avatarUrl: 'https://gravatar.example/x',
    };
    client.storage.uploadFiles.mockResolvedValueOnce({
      body: { processedFiles: [{ id: NEW }] },
    });
    client.graphql.request.mockResolvedValueOnce({
      body: { data: { updateUser: { id: 'user-1' } } },
    });

    await uploadAvatar(image());

    expect(client.storage.deleteFile).not.toHaveBeenCalled();
  });

  // avatar_url is the user's to set, so one under this app's prefix can still
  // name something other than a file.
  it('leaves an avatar under its prefix alone when the tail is not a file id', async () => {
    client.verifiedUser = { id: 'user-1', avatarUrl: '/api/avatar/..' };
    client.storage.uploadFiles.mockResolvedValueOnce({
      body: { processedFiles: [{ id: NEW }] },
    });
    client.graphql.request.mockResolvedValueOnce({
      body: { data: { updateUser: { id: 'user-1' } } },
    });

    expect(await uploadAvatar(image())).toEqual({ success: true });
    expect(client.storage.deleteFile).not.toHaveBeenCalled();
  });

  // The cookie is patched by this app's actions and otherwise rewritten on
  // refresh, so an avatar set in another browser is missing from it for an
  // access token's life, and anyone can write one.
  it('takes the previous avatar and the id from the auth service, not the cookie', async () => {
    client.session = {
      user: { id: 'cookie-user', avatarUrl: 'https://gravatar.example/x' },
    };
    client.verifiedUser = { id: 'user-1', avatarUrl: `/api/avatar/${OLD}` };
    client.storage.uploadFiles.mockResolvedValueOnce({
      body: { processedFiles: [{ id: NEW }] },
    });
    client.graphql.request.mockResolvedValueOnce({
      body: { data: { updateUser: { id: 'user-1' } } },
    });
    client.storage.deleteFile.mockResolvedValueOnce({ body: undefined });

    expect(await uploadAvatar(image())).toEqual({ success: true });
    expect(client.graphql.request.mock.calls[0]?.[0]).toMatchObject({
      variables: { id: 'user-1', avatarUrl: `/api/avatar/${NEW}` },
    });
    expect(client.storage.deleteFile).toHaveBeenCalledWith(OLD);
  });

  it('refuses when the auth service does not vouch for anyone', async () => {
    client.verifiedUser = null;

    expect((await uploadAvatar(image())).error).toBe(
      'You are signed out. Sign in and try again.',
    );
    expect(client.storage.uploadFiles).not.toHaveBeenCalled();
  });

  it('does not point the account at a file storage did not keep', async () => {
    client.storage.uploadFiles.mockResolvedValueOnce({
      body: { processedFiles: [] },
    });

    expect((await uploadAvatar(image())).error).toBe(
      'The storage service did not keep the file.',
    );
    expect(client.graphql.request).not.toHaveBeenCalled();
  });

  // The upload lands before the account is pointed at it, so a failed update
  // would otherwise leave a file nothing refers to. The previous avatar is
  // still the account's and stays.
  describe('when the account update fails after the upload', () => {
    beforeEach(() => {
      client.verifiedUser = { id: 'user-1', avatarUrl: `/api/avatar/${OLD}` };
      client.storage.uploadFiles.mockResolvedValueOnce({
        body: { processedFiles: [{ id: NEW }] },
      });
      client.storage.deleteFile.mockResolvedValueOnce({ body: undefined });
    });

    it('deletes the new file when nothing was updated', async () => {
      client.graphql.request.mockResolvedValueOnce({
        body: { data: { updateUser: null } },
      });

      expect(await uploadAvatar(image())).toEqual({
        error: 'The backend did not update this account.',
      });
      expect(client.storage.deleteFile.mock.calls).toEqual([[NEW]]);
      expect(updateSessionUser).not.toHaveBeenCalled();
    });

    it('deletes the new file when the mutation returns errors', async () => {
      client.graphql.request.mockResolvedValueOnce({
        body: {
          errors: [
            {
              message: "field 'updateUser' not found in type: 'mutation_root'",
            },
          ],
        },
      });

      expect((await uploadAvatar(image())).error).toContain('nhost/metadata');
      expect(client.storage.deleteFile.mock.calls).toEqual([[NEW]]);
    });

    it('deletes the new file when the mutation throws', async () => {
      client.graphql.request.mockRejectedValueOnce(new Error('network down'));

      expect(await uploadAvatar(image())).toEqual({
        error: 'Could not update the avatar: network down',
      });
      expect(client.storage.deleteFile.mock.calls).toEqual([[NEW]]);
    });

    it('still reports the update error when the cleanup fails', async () => {
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
      client.graphql.request.mockResolvedValueOnce({
        body: { data: { updateUser: null } },
      });
      client.storage.deleteFile.mockReset();
      client.storage.deleteFile.mockRejectedValueOnce(new Error('gone'));

      expect(await uploadAvatar(image())).toEqual({
        error: 'The backend did not update this account.',
      });
      expect(logged).toHaveBeenCalled();
    });
  });
});

describe('resendVerification', () => {
  it('sends to the address the auth service vouches for', async () => {
    client.auth.sendVerificationEmail.mockResolvedValueOnce({ body: {} });

    expect(await resendVerification()).toEqual({ success: true });
    expect(client.auth.sendVerificationEmail).toHaveBeenCalledWith({
      email: 'user@example.com',
      options: { redirectTo: `${appOrigin()}/account` },
    });
  });

  it('refuses when the auth service does not vouch for anyone', async () => {
    client.verifiedUser = null;

    expect(await resendVerification()).toEqual({
      error: 'You are signed out. Sign in and try again.',
    });
    expect(client.auth.sendVerificationEmail).not.toHaveBeenCalled();
  });
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

  // `avatar_url` is the user's to set, so a URL this app did not write names
  // no file of ours. Clearing it still works, which is what takes the
  // gravatar a fresh account starts with off the page.
  it('clears an avatar this app did not upload without deleting a file', async () => {
    client.verifiedUser = {
      id: 'user-1',
      avatarUrl: 'https://gravatar.example/x',
    };
    client.graphql.request.mockResolvedValueOnce({
      body: { data: { updateUser: { id: 'user-1' } } },
    });

    expect(await removeAvatar()).toEqual({ success: true });
    expect(client.graphql.request.mock.calls[0]?.[0]).toMatchObject({
      variables: { id: 'user-1', avatarUrl: '' },
    });
    expect(client.storage.deleteFile).not.toHaveBeenCalled();
  });

  it('has nothing to do when the account has no avatar', async () => {
    client.verifiedUser = { id: 'user-1' };

    expect(await removeAvatar()).toEqual({
      error: 'There is no avatar to remove.',
    });
    expect(client.graphql.request).not.toHaveBeenCalled();
  });

  // The other order would leave the account pointing at a file that is gone.
  it('keeps the file when the account could not be cleared', async () => {
    client.graphql.request.mockResolvedValueOnce({
      body: { data: { updateUser: null } },
    });

    expect(await removeAvatar()).toEqual({
      error: 'The backend did not update this account.',
    });
    expect(client.storage.deleteFile).not.toHaveBeenCalled();
    expect(updateSessionUser).not.toHaveBeenCalled();
  });

  // The avatar is already gone from the account, so a file left behind is a
  // log line rather than something the visitor has to act on.
  it('still succeeds when the file delete fails', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    client.graphql.request.mockResolvedValueOnce({
      body: { data: { updateUser: { id: 'user-1' } } },
    });
    client.storage.deleteFile.mockRejectedValueOnce(new Error('gone'));

    expect(await removeAvatar()).toEqual({ success: true });
    expect(logged).toHaveBeenCalled();
  });

  it('refuses when the auth service does not vouch for anyone', async () => {
    client.verifiedUser = null;

    expect(await removeAvatar()).toEqual({
      error: 'You are signed out. Sign in and try again.',
    });
    expect(client.graphql.request).not.toHaveBeenCalled();
  });
});

describe('deleteAccount', () => {
  const MINE = '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b';

  const deleted = () => ({
    body: { data: { deleteUser: { id: 'user-1' } } },
  });

  it('deletes the row and clears this browser', async () => {
    client.graphql.request.mockResolvedValueOnce(deleted());

    expect(await deleteAccount()).toEqual({ success: true });
    expect(client.graphql.request.mock.calls[0]?.[0]).toMatchObject({
      variables: { id: 'user-1' },
    });
    expect(signOut).toHaveBeenCalledOnce();
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

  // Only a file this app wrote names anything of ours to delete.
  it('deletes no file for an avatar this app did not upload', async () => {
    client.verifiedUser = {
      id: 'user-1',
      avatarUrl: 'https://gravatar.example/x',
    };
    client.graphql.request.mockResolvedValueOnce(deleted());

    expect(await deleteAccount()).toEqual({ success: true });
    expect(client.storage.deleteFile).not.toHaveBeenCalled();
  });

  // Losing the avatar is not a reason to leave the account standing.
  it('closes the account even when the avatar delete fails', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    client.verifiedUser = { id: 'user-1', avatarUrl: `/api/avatar/${MINE}` };
    client.storage.deleteFile.mockRejectedValueOnce(new Error('gone'));
    client.graphql.request.mockResolvedValueOnce(deleted());

    expect(await deleteAccount()).toEqual({ success: true });
    expect(logged).toHaveBeenCalled();
  });

  // The permission in nhost/metadata is what makes the delete match a row,
  // so nothing coming back means the account is still there.
  it('stays signed in when nothing was deleted', async () => {
    client.graphql.request.mockResolvedValueOnce({
      body: { data: { deleteUser: null } },
    });

    expect(await deleteAccount()).toEqual({
      error: 'The backend did not delete this account.',
    });
    expect(signOut).not.toHaveBeenCalled();
  });

  it('reports a mutation that came back with errors', async () => {
    client.graphql.request.mockResolvedValueOnce({
      body: {
        errors: [
          { message: "field 'deleteUser' not found in type: 'mutation_root'" },
        ],
      },
    });

    expect((await deleteAccount()).error).toContain('nhost/metadata');
    expect(signOut).not.toHaveBeenCalled();
  });

  it('refuses when the auth service does not vouch for anyone', async () => {
    client.verifiedUser = null;

    expect(await deleteAccount()).toEqual({
      error: 'You are signed out. Sign in and try again.',
    });
    expect(client.graphql.request).not.toHaveBeenCalled();
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

  it('names the metadata when the schema lacks the table', async () => {
    client.graphql.request.mockResolvedValueOnce({
      body: {
        errors: [
          {
            message:
              "field 'authRefreshTokens' not found in type: 'query_root'",
          },
        ],
      },
    });

    expect((await listSessions()).error).toContain('nhost/metadata');
  });

  it('refuses without a session', async () => {
    client.session = null;

    expect((await listSessions()).error).toBe(
      'You are signed out. Sign in and try again.',
    );
    expect(client.graphql.request).not.toHaveBeenCalled();
  });
});

describe('signOutSession', () => {
  beforeEach(() => {
    client.session = { refreshTokenId: 'this-one', user: { id: 'user-1' } };
  });

  it('deletes the session row', async () => {
    client.graphql.request.mockResolvedValueOnce({
      body: { data: { deleteAuthRefreshToken: { id: 'other' } } },
    });

    expect(await signOutSession('other')).toEqual({ success: true });
    expect(client.graphql.request.mock.calls[0][0].variables).toEqual({
      id: 'other',
    });
  });

  // Deleting the row under this browser would leave it holding cookies for a
  // session that no longer exists.
  it('refuses the session in use', async () => {
    expect((await signOutSession('this-one')).error).toContain(
      'Sign out from the menu',
    );
    expect(client.graphql.request).not.toHaveBeenCalled();
  });

  // The permission filters by user, so another account's session deletes
  // nothing rather than failing.
  it("reports a session that is not this account's", async () => {
    client.graphql.request.mockResolvedValueOnce({
      body: { data: { deleteAuthRefreshToken: null } },
    });

    expect(await signOutSession('someone-elses')).toEqual({
      error: 'That session is not on this account.',
    });
  });

  it('refuses without a session', async () => {
    client.session = null;

    expect((await signOutSession('other')).error).toBe(
      'You are signed out. Sign in and try again.',
    );
  });
});
