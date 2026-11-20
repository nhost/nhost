import type {
  CredentialAssertionResponse,
  CredentialCreationResponse,
  PublicKeyCredentialCreationOptions,
  PublicKeyCredentialRequestOptions,
} from '@nhost/nhost-js/auth';
import {
  Passkey,
  type PasskeyCreateRequest,
  type PasskeyGetRequest,
} from 'react-native-passkey';

// The device's half of a ceremony, as `@simplewebauthn/browser` is on the web:
// auth's options go to the OS as WebAuthn JSON, and the credential comes back
// in the shape auth's verify endpoints take, with the `type` and assertion
// `rawId` the module can leave out filled in. The module types the options
// more narrowly than auth, with string unions where auth has `string`; auth
// only sends values WebAuthn defines.

export function supportsPasskeys(): boolean {
  return Passkey.isSupported();
}

export async function startRegistration(
  options: PublicKeyCredentialCreationOptions,
): Promise<CredentialCreationResponse> {
  const { id, rawId, type, authenticatorAttachment, response } =
    await Passkey.create(options as PasskeyCreateRequest);

  // The app asks for no extensions, so there are no results to send.
  return {
    id,
    rawId,
    type: type || 'public-key',
    authenticatorAttachment,
    response,
    clientExtensionResults: {},
  };
}

export async function startAuthentication(
  options: PublicKeyCredentialRequestOptions,
): Promise<CredentialAssertionResponse> {
  const { id, rawId, type, authenticatorAttachment, response } =
    await Passkey.get(options as PasskeyGetRequest);

  return {
    id,
    rawId: rawId || id,
    type: type || 'public-key',
    authenticatorAttachment,
    response,
    clientExtensionResults: {},
  };
}
