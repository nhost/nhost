import Cookies from 'cookies'
import { NextPageContext } from 'next'

import { NHOST_NEXT_REFRESH_KEY, NHOST_REFRESH_TOKEN_KEY, NhostSession } from '@nhost/client'

import { refresh } from './utils'

export const getNhostSession = async (
  backendUrl: string,
  context: NextPageContext
): Promise<NhostSession | null> => {
  let session: NhostSession | null = null
  if (context.req && context.res) {
    const cookies = Cookies(context.req, context.res)

    const refreshToken = cookies.get(NHOST_REFRESH_TOKEN_KEY) ?? null
    if (refreshToken) {
      session = await refresh(backendUrl, refreshToken)
      if (session) {
        cookies.set(NHOST_REFRESH_TOKEN_KEY, session.refreshToken, {
          httpOnly: false,
          sameSite: true
        })
        cookies.set(
          NHOST_NEXT_REFRESH_KEY,
          new Date(Date.now() + (session.accessTokenExpiresIn || 0) * 1_000).toISOString(),
          {
            httpOnly: false,
            sameSite: true
          }
        )
      }
    }
  }
  return session
}
