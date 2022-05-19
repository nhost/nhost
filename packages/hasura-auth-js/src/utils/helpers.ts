import { AuthContext, SessionActionHandlerResult } from '@nhost/core'

import { Session, SignUpResponse } from './types'

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

export const getAuthenticationResult = ({
  accessToken,
  isError,
  user,
  error
}: SessionActionHandlerResult): SignUpResponse => {
  if (isError) {
    return {
      session: null,
      error
    }
  }
  if (user && accessToken) {
    return {
      session: { accessToken, accessTokenExpiresIn: 0, refreshToken: 'TODO', user },
      error: null
    }
  }
  return { session: null, error: null }
}
