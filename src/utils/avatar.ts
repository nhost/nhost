import { url } from 'gravatar';
import { ENV } from './env';

export const getGravatarUrl = (email?: string) => {
  if (ENV.AUTH_GRAVATAR_ENABLED && email) {
    return url(email, {
      r: ENV.AUTH_GRAVATAR_RATING,
      protocol: 'https',
      default: ENV.AUTH_GRAVATAR_DEFAULT,
    });
  }
};
