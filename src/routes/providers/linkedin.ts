import { Router } from 'express'
import { Strategy } from 'passport-linkedin-oauth2'
import { initProvider } from './utils'
import { PROVIDERS } from '@config/index'

export default (router: Router): void => {
  const options = PROVIDERS.linkedin

  initProvider(router, 'linkedin', Strategy, {
    scope: PROVIDERS.linkedin?.scope
  }, (req, res, next) => {
    if(!PROVIDERS.linkedin) {
      return res.boom.badImplementation(`Please set the LINKEDIN_ENABLED env variable to true to use the auth/providers/linkedin routes.`)
    } else if (!options?.clientID || !options?.clientSecret) {
      return res.boom.badImplementation(`Missing environment variables for LinkedIn OAuth.`)
    } else {
      return next();
    }
  })
}
