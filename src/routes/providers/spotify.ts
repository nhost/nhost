import { Router } from 'express'
import { Strategy } from 'passport-spotify'
import { PROVIDERS } from '@config/index'
import { initProvider } from './utils'

export default (router: Router): void => {
  const options = PROVIDERS.spotify

  initProvider(router, 'spotify', Strategy, {
      scope: PROVIDERS.spotify?.scope
  }, (req, res, next) => {
    if(!PROVIDERS.spotify) {
      return res.boom.notImplemented(`Please set the SPOTIFY_ENABLED env variable to true to use the auth/providers/spotify routes`)
    } else if (!options?.clientID || !options?.clientSecret) {
      throw new Error(`Missing environment variables for Spotify OAuth`)
    } else {
      return next();
    }
  })
}
