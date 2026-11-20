import type {
  PublicKeyCredentialCreationOptions,
  PublicKeyCredentialRequestOptions,
} from '@nhost/nhost-js/auth';
import { Passkey } from 'react-native-passkey';
import {
  startAuthentication,
  startRegistration,
} from '@/screens/auth/passkey/ceremony';

jest.mock('react-native-passkey', () => ({
  Passkey: { create: jest.fn(), get: jest.fn(), isSupported: () => true },
}));

const create = jest.mocked(Passkey.create);
const get = jest.mocked(Passkey.get);

const creationOptions = {
  challenge: 'Y2hhbGxlbmdl',
  rp: { id: 'example.com', name: 'Nhost' },
  user: { id: 'dXNlcg', name: 'ada@example.com', displayName: 'Ada' },
  pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
  excludeCredentials: [{ type: 'public-key', id: 'b2xk' }],
} as PublicKeyCredentialCreationOptions;

const requestOptions = {
  challenge: 'Y2hhbGxlbmdl',
  rpId: 'example.com',
  userVerification: 'preferred',
} as PublicKeyCredentialRequestOptions;

beforeEach(() => {
  create.mockReset();
  get.mockReset();
});

// What the OS answers with, in the shape the verify endpoints take.
describe('passkey ceremony', () => {
  it("hands auth's creation options to the OS and returns a full credential", async () => {
    const response = { clientDataJSON: 'cd', attestationObject: 'ao' };
    create.mockResolvedValueOnce({
      id: 'cred',
      rawId: 'cred',
      response,
      clientExtensionResults: { largeBlob: { supported: false } },
    });

    expect(await startRegistration(creationOptions)).toEqual({
      id: 'cred',
      rawId: 'cred',
      type: 'public-key',
      authenticatorAttachment: undefined,
      response,
      clientExtensionResults: {},
    });
    expect(create).toHaveBeenCalledWith(creationOptions);
  });

  it("hands auth's request options to the OS and returns a full assertion", async () => {
    const response = {
      clientDataJSON: 'cd',
      authenticatorData: 'ad',
      signature: 'sig',
      userHandle: 'dXNlcg',
    };
    get.mockResolvedValueOnce({
      id: 'cred',
      authenticatorAttachment: 'platform',
      response,
    });

    expect(await startAuthentication(requestOptions)).toEqual({
      id: 'cred',
      rawId: 'cred',
      type: 'public-key',
      authenticatorAttachment: 'platform',
      response,
      clientExtensionResults: {},
    });
    expect(get).toHaveBeenCalledWith(requestOptions);
  });

  // The PasskeyForm and ManagePasskeys tests read these by name.
  it('passes the error the OS reported through', async () => {
    const cancelled = { error: 'UserCancelled', message: 'cancelled' };
    get.mockRejectedValueOnce(cancelled);

    await expect(startAuthentication(requestOptions)).rejects.toBe(cancelled);
  });
});
