import { Router } from 'express'
import { Strategy } from 'passport-google-oauth20'
import { initProvider } from './utils'
import { PROVIDERS } from '@config/index'

export default (router: Router): void => {
  const options = PROVIDERS.google

  initProvider(router, 'google', Strategy, { scope: PROVIDERS.google?.scope }, (req, res, next) => {
    if(!PROVIDERS.google) {
      return res.boom.notImplemented(`Please set the GOOGLE_ENABLED env variable to true to use the auth/providers/google routes`)
    } else if (!options?.clientID || !options?.clientSecret) {
      throw new Error(`Missing environment variables for Google OAuth`)
    } else {
      return next();
    }
  })
}
