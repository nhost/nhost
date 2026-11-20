import type { CredentialCreationResponse } from '@nhost/nhost-js/auth';
import { SIGNED_OUT } from '@/lib/nhost/errors';
import {
  finishAddPasskey,
  listPasskeys,
  removePasskey,
} from '@/screens/auth/passkey/manage/actions';

const mockClient = {
  session: null as object | null,
  verifyAddSecurityKey: jest.fn(),
  request: jest.fn(),
};

jest.mock('@/lib/nhost/client', () => ({
  nhost: {
    getUserSession: () => mockClient.session,
    auth: {
      verifyAddSecurityKey: (...args: unknown[]) =>
        mockClient.verifyAddSecurityKey(...args),
    },
    graphql: {
      request: (...args: unknown[]) => mockClient.request(...args),
    },
  },
}));

const creation = { id: 'cred' } as unknown as CredentialCreationResponse;

beforeEach(() => {
  mockClient.session = { accessToken: 'token' };
  mockClient.verifyAddSecurityKey.mockReset();
  mockClient.request.mockReset();
});

describe('listPasskeys', () => {
  it('returns the keys the query answered with', async () => {
    const keys = [{ id: 'k1', credentialId: 'c1', nickname: 'laptop' }];
    mockClient.request.mockResolvedValueOnce({
      body: { data: { authUserSecurityKeys: keys } },
    });

    expect(await listPasskeys()).toEqual({ keys });
  });

  it('asks nothing of a signed-out visitor', async () => {
    mockClient.session = null;

    expect(await listPasskeys()).toEqual({ error: SIGNED_OUT });
    expect(mockClient.request).not.toHaveBeenCalled();
  });
});

describe('adding a passkey', () => {
  it('sends the credential with the nickname it was given', async () => {
    mockClient.verifyAddSecurityKey.mockResolvedValue({ body: { id: 'k' } });

    expect(await finishAddPasskey(creation, ' laptop ')).toEqual({
      success: true,
    });
    expect(mockClient.verifyAddSecurityKey).toHaveBeenLastCalledWith({
      credential: creation,
      nickname: 'laptop',
    });
  });
});

describe('removePasskey', () => {
  // The permission filters by user, so another's id deletes nothing.
  it('says so when nothing was deleted', async () => {
    mockClient.request.mockResolvedValueOnce({
      body: { data: { deleteAuthUserSecurityKey: null } },
    });

    expect(await removePasskey('k1')).toEqual({
      error: 'That passkey is not on this account.',
    });
  });
});
