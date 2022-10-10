import { Router } from 'express';
import AzureAdOAuth2Strategy from 'passport-azure-ad-oauth2';
import { PROVIDERS } from '@config';
import { sendError } from '@/errors';
import { initProvider } from './utils';

export default (router: Router): void => {
  const options = PROVIDERS.azuread;

  initProvider(
    router,
    'azuread',
    AzureAdOAuth2Strategy,
    {},
    (req, res, next) => {
      if (!PROVIDERS.azuread) {
        return sendError(res, 'disabled-endpoint');
      } else if (!options?.clientID || !options?.clientSecret) {
        throw new Error(`Missing environment variables for Azure OAuth`);
      } else {
        return next();
      }
    }
  );
};
