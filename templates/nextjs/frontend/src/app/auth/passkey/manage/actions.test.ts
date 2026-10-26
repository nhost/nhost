import type { CredentialCreationResponse } from '@nhost/nhost-js/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  beginAddPasskey,
  finishAddPasskey,
  listPasskeys,
  removePasskey,
} from '@/app/auth/passkey/manage/actions';

const client = vi.hoisted(() => ({
  session: null as object | null,
  auth: { addSecurityKey: vi.fn(), verifyAddSecurityKey: vi.fn() },
  graphql: { request: vi.fn() },
}));

vi.mock('@/lib/nhost/server', () => ({
  createNhostClient: async () => ({
    getUserSession: () => client.session,
    auth: client.auth,
    graphql: client.graphql,
  }),
}));

const creation = { id: 'cred' } as unknown as CredentialCreationResponse;
const signedOut = { error: 'You are signed out. Sign in and try again.' };

beforeEach(() => {
  client.session = { accessToken: 'token' };
  client.auth.addSecurityKey.mockReset();
  client.auth.verifyAddSecurityKey.mockReset();
  client.graphql.request.mockReset();
});

describe('listPasskeys', () => {
  it('returns the keys the query answered with', async () => {
    const keys = [{ id: 'k1', credentialId: 'c1', nickname: 'laptop' }];
    client.graphql.request.mockResolvedValueOnce({
      body: { data: { authUserSecurityKeys: keys } },
    });

    expect(await listPasskeys()).toEqual({ keys });
  });

  // The symptom of nhost/metadata not having been applied is a GraphQL
  // schema without the field. The message should name the cause.
  it('names the missing permission when the field is not in the schema', async () => {
    client.graphql.request.mockResolvedValueOnce({
      body: {
        errors: [
          {
            message:
              "field 'authUserSecurityKeys' not found in type: 'query_root'",
          },
        ],
      },
    });

    const result = await listPasskeys();

    expect(result.error).toContain('nhost/metadata');
    expect(result.keys).toBeUndefined();
  });

  it('refuses without a session', async () => {
    client.session = null;

    expect(await listPasskeys()).toEqual(signedOut);
    expect(client.graphql.request).not.toHaveBeenCalled();
  });
});

describe('adding a passkey', () => {
  it('hands back the creation options the backend issued', async () => {
    const options = { challenge: 'c' };
    client.auth.addSecurityKey.mockResolvedValueOnce({ body: options });

    expect(await beginAddPasskey()).toEqual({ options });
  });

  it('sends the credential with the nickname it was given', async () => {
    client.auth.verifyAddSecurityKey.mockResolvedValue({ body: { id: 'k' } });

    expect(await finishAddPasskey(creation, 'laptop')).toEqual({
      success: true,
    });
    expect(client.auth.verifyAddSecurityKey).toHaveBeenLastCalledWith({
      credential: creation,
      nickname: 'laptop',
    });
  });

  // The form starts with a name, so a blank one was cleared on purpose.
  it('leaves a passkey whose name was cleared unnamed', async () => {
    client.auth.verifyAddSecurityKey.mockResolvedValue({ body: { id: 'k' } });

    await finishAddPasskey(creation, '  ');

    expect(client.auth.verifyAddSecurityKey).toHaveBeenLastCalledWith({
      credential: creation,
      nickname: undefined,
    });
  });

  it('refuses both halves without a session', async () => {
    client.session = null;

    expect(await beginAddPasskey()).toEqual(signedOut);
    expect(await finishAddPasskey(creation, '')).toEqual(signedOut);
  });
});

describe('removePasskey', () => {
  it('deletes by id', async () => {
    client.graphql.request.mockResolvedValueOnce({
      body: { data: { deleteAuthUserSecurityKey: { id: 'k1' } } },
    });

    expect(await removePasskey('k1')).toEqual({ success: true });
    expect(client.graphql.request.mock.calls[0]?.[0]).toMatchObject({
      variables: { id: 'k1' },
    });
  });

  // The permission filters by user, so someone else's id deletes nothing
  // and the mutation answers null rather than erroring.
  it('reports an id that is not this account\u2019s', async () => {
    client.graphql.request.mockResolvedValueOnce({
      body: { data: { deleteAuthUserSecurityKey: null } },
    });

    expect(await removePasskey('theirs')).toEqual({
      error: 'That passkey is not on this account.',
    });
  });

  it('asks for an id before calling the backend', async () => {
    expect(await removePasskey('')).toEqual({ error: 'Which passkey?' });
    expect(client.graphql.request).not.toHaveBeenCalled();
  });
});
