import { EmailType } from '@/types';
import { ENV } from './env';

export const generateRedirectUrl = (
  redirectTo: string,
  queryParameters: { [key: string]: string }
): string => {
  const url = new URL(redirectTo);
  for (const [key, value] of Object.entries(queryParameters)) {
    url.searchParams.set(key, value);
  }

  return url.href;
};

export const createEmailRedirectionLink = (
  type: EmailType,
  ticket: string,
  redirectTo: string
): string => {
  const url = new URL(`${ENV.AUTH_SERVER_URL}/verify`)
  url.searchParams.set('ticket', ticket)
  url.searchParams.set('type', type)
  url.searchParams.set('redirectTo', redirectTo)
  return url.toString()
};
