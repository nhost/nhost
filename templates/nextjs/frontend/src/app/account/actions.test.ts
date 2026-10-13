import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  changeEmail,
  changePassword,
  resendVerification,
  updateDisplayName,
  uploadAvatar,
} from '@/app/account/actions';
import { appOrigin } from '@/lib/nhost/env';

const client = vi.hoisted(() => ({
  session: null as { user?: { id: string; avatarUrl?: string } } | null,
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

vi.mock('@/lib/nhost/server', () => ({
  createNhostClient: async () => ({
    getUserSession: () => client.session,
    auth: client.auth,
    graphql: client.graphql,
    storage: client.storage,
  }),
  getVerifiedUser: async () => client.verifiedUser,
}));

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

  // The permission filters by the token's user, so a row that is not this
  // user's comes back null rather than erroring.
  it('reports when nothing was updated', async () => {
    client.graphql.request.mockResolvedValueOnce({
      body: { data: { updateUser: null } },
    });

    expect(await updateDisplayName('Ada')).toEqual({
      error: 'The backend did not update this account.',
    });
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
    client.verifiedUser = { id: 'user-1', avatarUrl: '/api/avatar/old' };
    client.storage.uploadFiles.mockResolvedValueOnce({
      body: { processedFiles: [{ id: 'new' }] },
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
      variables: { id: 'user-1', avatarUrl: '/api/avatar/new' },
    });
    expect(client.storage.deleteFile).toHaveBeenCalledWith('old');
  });

  // A fresh account's avatar is a gravatar URL, which is not a file of ours
  // to delete.
  it('leaves an avatar it did not write alone', async () => {
    client.verifiedUser = {
      id: 'user-1',
      avatarUrl: 'https://gravatar.example/x',
    };
    client.storage.uploadFiles.mockResolvedValueOnce({
      body: { processedFiles: [{ id: 'new' }] },
    });
    client.graphql.request.mockResolvedValueOnce({
      body: { data: { updateUser: { id: 'user-1' } } },
    });

    await uploadAvatar(image());

    expect(client.storage.deleteFile).not.toHaveBeenCalled();
  });

  // The cookie's user is only rewritten on refresh, so a second upload within
  // one access token's life still sees the avatar from before the first.
  it('takes the previous avatar and the id from the auth service, not the cookie', async () => {
    client.session = {
      user: { id: 'cookie-user', avatarUrl: 'https://gravatar.example/x' },
    };
    client.verifiedUser = { id: 'user-1', avatarUrl: '/api/avatar/first' };
    client.storage.uploadFiles.mockResolvedValueOnce({
      body: { processedFiles: [{ id: 'second' }] },
    });
    client.graphql.request.mockResolvedValueOnce({
      body: { data: { updateUser: { id: 'user-1' } } },
    });
    client.storage.deleteFile.mockResolvedValueOnce({ body: undefined });

    expect(await uploadAvatar(image())).toEqual({ success: true });
    expect(client.graphql.request.mock.calls[0]?.[0]).toMatchObject({
      variables: { id: 'user-1', avatarUrl: '/api/avatar/second' },
    });
    expect(client.storage.deleteFile).toHaveBeenCalledWith('first');
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
