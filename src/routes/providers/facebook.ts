import { Router } from 'express'
import { Strategy } from 'passport-facebook'
import { PROVIDERS } from '@config/index'
import { initProvider } from './utils'

export default (router: Router): void => {
  const options = PROVIDERS.facebook

  initProvider(router, 'facebook', Strategy, { profileFields: PROVIDERS.facebook?.profileFields  }, (req, res, next) => {
    if(!PROVIDERS.facebook) {
      return res.boom.notImplemented(`Please set the FACEBOOK_ENABLED env variable to true to use the auth/providers/facebook routes`)
    } else if (!options?.clientID || !options?.clientSecret) {
      throw new Error(`Missing environment variables for Facebook OAuth`)
    } else {
      return next();
    }
  })
}
