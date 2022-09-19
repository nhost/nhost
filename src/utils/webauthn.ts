import { ENV } from './env';

export const getWebAuthnRelyingParty = () =>
  ENV.AUTH_CLIENT_URL && new URL(ENV.AUTH_CLIENT_URL).hostname;
