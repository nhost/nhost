import type { CredentialCreationResponse } from '@nhost/nhost-js/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  finishAddPasskey,
  listPasskeys,
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
const _signedOut = { error: 'You are signed out. Sign in and try again.' };

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
});

describe('adding a passkey', () => {
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
});
