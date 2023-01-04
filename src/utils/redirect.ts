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
) =>
  `${
    ENV.AUTH_SERVER_URL
  }/verify?&ticket=${ticket}&type=${type}&redirectTo=${encodeURIComponent(
    redirectTo
  )}`;
