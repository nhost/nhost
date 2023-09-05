import { NHOST_REFRESH_TOKEN_KEY, NhostClient, NhostSession } from '@nhost/nhost-js'
import { cookies } from 'next/headers'

// eslint-disable-next-line @next/next/no-server-import-in-page
import { NextRequest } from 'next/server'
import { StateFrom } from 'xstate/lib/types'

import { waitFor } from 'xstate/lib/waitFor'

export const NHOST_SESSION_KEY = 'nhostSession'

export const getNhost = async (request?: NextRequest) => {
  const $cookies = request?.cookies || cookies()

  const nhost = new NhostClient({
    subdomain: process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || 'local',
    region: process.env.NEXT_PUBLIC_NHOST_REGION,
    clientStorageType: 'custom',
    clientStorage: {
      getItem: (key) => $cookies.get(key),
      setItem: (key, value) => $cookies.set(key, value),
      removeItem: (key) => $cookies.delete(key)
    },
    start: false,
    autoRefreshToken: false,
    autoSignIn: true
  })

  const session: NhostSession = JSON.parse($cookies.get(NHOST_SESSION_KEY)?.value || 'null')
  const refreshToken = $cookies.get(NHOST_REFRESH_TOKEN_KEY)?.value || null

  nhost.auth.client.start({
    initialSession: {
      ...session,
      refreshToken
    }
  })

  await waitFor(nhost.auth.client.interpreter!, (state: StateFrom<any>) => !state.hasTag('loading'))

  return nhost
}
