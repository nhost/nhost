import { AuthContext } from '@nhost/core'

import { Session } from './types'

export const isBrowser = () => typeof window !== 'undefined'

export const getSession = (context?: AuthContext): Session | null => {
  if (
    !context ||
    !context.accessToken.value ||
    !context.refreshToken.value ||
    !context.accessToken.expiresAt ||
    !context.user
  ) {
    return null
  }
  return {
    accessToken: context.accessToken.value,
    accessTokenExpiresIn: (context.accessToken.expiresAt.getTime() - Date.now()) / 1000,
    refreshToken: context.refreshToken.value,
    user: context.user
  }
}
