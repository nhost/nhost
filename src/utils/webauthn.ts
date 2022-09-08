import { ENV } from './env';

export const getWebAuthnRelyingParty = () =>
  ENV.AUTH_SERVER_URL && new URL(ENV.AUTH_SERVER_URL).hostname;
