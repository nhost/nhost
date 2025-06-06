// import 'server-only' // TODO?
import { cookies } from 'next/headers'
import {
  type AuthMachine,
  type NhostClient,
  type NhostReactClientConstructorParams,
  type NhostSession,
  NHOST_REFRESH_TOKEN_KEY,
  VanillaNhostClient
} from '@nhost/react/server'
import { type StateFrom } from 'xstate'
import { waitFor } from 'xstate/lib/waitFor'
import { NHOST_SESSION_KEY } from './constants'
import { type SearchParams } from 'next/dist/server/request/search-params'

export type CreateServerSideClientParams = Partial<
  Pick<
    NhostReactClientConstructorParams,
    'subdomain' | 'region' | 'authUrl' | 'functionsUrl' | 'graphqlUrl' | 'storageUrl'
  >
>

/**
 * Creates an Nhost client that runs on the server side.
 * It will try to get the refresh token in cookies, or from the request URL
 * If a refresh token is found, it uses it to get an up to date access token (JWT) and a user session
 * This method resolves when the authentication status is known eventually
 * @param config - An object containing connection information
 * @param searchParams - URL search parameters if needing to read tokens from URL (e.g., after OAuth redirect)
 * @returns instance of `NhostClient` that is ready to use on the server side (signed in or signed out)
 */
export const createServerSideClient = async (
  params: CreateServerSideClientParams,
  searchParams: SearchParams
): Promise<NhostClient> => {
  const cookieStore = await cookies() // Get the cookie store from next/headers

  const nhost = new VanillaNhostClient({
    ...params,
    clientStorageType: 'custom',
    clientStorage: {
      getItem: (key: string) => {
        // TODO does not perfectly work in the same way as the 'regular' client:
        // in the authentication machine, if the refresh token is null but an error is found in the url, then the authentication stops and fails.
        // * When the requested key is `NHOST_REFRESH_TOKEN_KEY`, we have to look for the given 'refreshToken' value
        // * in the url as this is the key sent by hasura-auth
        //
        // Reading from URL query params
        const urlKey = key === NHOST_REFRESH_TOKEN_KEY ? 'refreshToken' : key
        const urlValue = searchParams[urlKey]
        if (typeof urlValue === 'string') {
          return urlValue
        }
        // Reading from cookies
        return cookieStore.get(key)?.value ?? null
      },
      setItem: (key: string, value: string) => {
        // TODO: Set expires based on the actual refresh token expire time
        // For now, we're using 30 days so the cookie is not removed when the browser is closed because if `expiers` is omitted, the cookie becomes a session cookie.
        cookieStore.set(key, value, { httpOnly: false, sameSite: 'strict', expires: 30 })
      },
      removeItem: (key: string) => {
        cookieStore.delete(key)
      }
    },
    start: false,
    autoRefreshToken: false,
    autoSignIn: true
  })

  const strSession = cookieStore.get(NHOST_SESSION_KEY)?.value
  const refreshToken = cookieStore.get(NHOST_REFRESH_TOKEN_KEY)?.value
  const initialSession: NhostSession = strSession &&
    refreshToken && { ...JSON.parse(strSession), refreshToken }

  nhost.auth.client.start({ initialSession })
  await waitFor(
    nhost.auth.client.interpreter!,
    (state: StateFrom<AuthMachine>) => !state.hasTag('loading')
  )
  return nhost
}
