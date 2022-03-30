import { Router } from 'express';
import { Strategy, Profile } from '@nicokaiser/passport-apple';
import { PROVIDERS } from '@config';
import { sendError } from '@/errors';
import { getGravatarUrl } from '@/utils';
import { initProvider } from './utils';

const transformProfile = ({
  id,
  name,
  email,
  photos,
}: Profile): {
  id: string;
  email?: string;
  displayName: string;
  avatarUrl: string;
} => ({
  id,
  email,
  displayName: name ? `${name.firstName} ${name.lastName}` : email,
  avatarUrl: photos?.[0].value || getGravatarUrl(email) || '',
});

export default (router: Router): void => {
  const options = PROVIDERS.apple;

  initProvider(
    router,
    'apple',
    Strategy,
    {
      scope: PROVIDERS.apple?.scope,
      transformProfile,
      callbackMethod: 'POST',
    },
    (req, res, next) => {
      if (!PROVIDERS.apple) {
        return sendError(res, 'disabled-endpoint');
      } else if (
        !options?.clientID ||
        !options?.teamID ||
        !options?.keyID ||
        !options?.key
      ) {
        throw new Error(`Missing environment variables for Apple OAuth`);
      } else {
        return next();
      }
    }
  );
};
