import { Router } from 'express'
import { Strategy } from 'passport-windowslive'
import { initProvider } from './utils'
import { PROVIDERS } from '@config/index'

export default (router: Router): void => {
  const options = PROVIDERS.windowslive

  initProvider(router, 'windowslive', Strategy, {
    scope: PROVIDERS.windowslive?.scope
  }, (req, res, next) => {
    if(!PROVIDERS.windowslive) {
      return res.boom.badImplementation(`Please set the WINDOWSLIVE_ENABLED env variable to true to use the auth/providers/windowslive routes.`)
    } else if (!options?.clientID || !options?.clientSecret) {
      return res.boom.badImplementation(`Missing environment variables for Windows Live OAuth.`)
    } else {
      return next();
    }
  })
}
