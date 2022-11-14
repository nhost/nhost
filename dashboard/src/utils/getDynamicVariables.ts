import { resolveProvider } from './resolveProvider';

export function getDynamicVariables(providerId, vars, prefill = false) {
  const authEnabled = `auth${resolveProvider(providerId as string)}Enabled`;
  const authClientId = `auth${resolveProvider(providerId as string)}ClientId`;
  const authClientSecret = `auth${resolveProvider(
    providerId as string,
  )}ClientSecret`;

  // @TODO: check prefill, use only one function: there's another one with the same functionality
  // in providerId.tsx.
  if (providerId === 'twitter') {
    return {
      authEnabled: 'authTwitterEnabled',
      authClientId: 'authTwitterConsumerKey',
      authClientSecret: 'authTwitterConsumerSecret',
    };
  }

  if (providerId === 'apple') {
    return {
      authEnabled: 'authAppleEnabled',
      authClientId: 'authAppleKeyId',
      authClientSecret: 'authApplePrivateKey',
    };
  }

  const {
    authProviderEnabled,
    authProviderClientId,
    authProviderClientSecret,
  } = vars;

  if (prefill) {
    return {
      authEnabled,
      authClientId,
      authClientSecret,
    };
  }

  return {
    [authEnabled]: authProviderEnabled,
    [authClientId]: authProviderClientId,
    [authClientSecret]: authProviderClientSecret,
  };
}

export default getDynamicVariables;
