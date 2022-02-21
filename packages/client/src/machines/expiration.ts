import { MIN_TOKEN_REFRESH_INTERVAL, TOKEN_REFRESH_MARGIN } from '../constants'

// TODO remove the '-50'
// TODO get rid of this and calculate in the 'should refresh' guard
export const getExpiration = (expiresIn: number = 0) =>
  Math.max(expiresIn - TOKEN_REFRESH_MARGIN, MIN_TOKEN_REFRESH_INTERVAL) - 50
