import { NhostClient, NhostSession } from '@nhost/nhost-js'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { type StateFrom } from 'xstate/lib/types'
import { waitFor } from 'xstate/lib/waitFor'

export const NHOST_SESSION_KEY = 'nhostSession'

export const getNhost = async (request?: NextRequest) => {
  const $cookies = request?.cookies || cookies()

  const nhost = new NhostClient({
    subdomain: process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || 'local',
    region: process.env.NEXT_PUBLIC_NHOST_REGION,
    start: false
  })

  const sessionCookieValue = $cookies.get(NHOST_SESSION_KEY)?.value || ''
  const initialSession: NhostSession = JSON.parse(atob(sessionCookieValue) || 'null')

  nhost.auth.client.start({ initialSession })
  await waitFor(nhost.auth.client.interpreter!, (state: StateFrom<any>) => !state.hasTag('loading'))

  return nhost
}
