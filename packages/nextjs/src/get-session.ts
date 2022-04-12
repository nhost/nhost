import Cookies from 'cookies'
import { GetServerSidePropsContext, NextPageContext } from 'next'

import { NHOST_JWT_EXPIRES_AT_KEY, NHOST_REFRESH_TOKEN_KEY, NhostSession } from '@nhost/core'

import { refresh } from './utils'

/**
 * Refreshes the access token if there is any and returns the Nhost session.
 *
 * @example
 * ### Using an arrow function
 *
 * ```js
 * export const getServerSideProps: GetServerSideProps = async (context) => {
 *   const nhostSession = await getNhostSession(BACKEND_URL, context)
 *
 *   return {
 *     props: {
 *       nhostSession
 *     }
 *   }
 * }
 * ```
 *
 * @example
 * ### Using a regular function
 *
 * ```js
 * export async function getServerSideProps(context: GetServerSidePropsContext) { // or NextPageContext
 *   const nhostSession = await getNhostSession(BACKEND_URL, context)
 *
 *   return {
 *     props: {
 *       nhostSession
 *     }
 *   }
 * }
 * ```
 *
 * @param backendUrl - URL of your Nhost application
 * @param context - Next.js context
 * @returns Nhost session
 */
export const getNhostSession = async (
  backendUrl: string,
  context: NextPageContext | GetServerSidePropsContext
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
          NHOST_JWT_EXPIRES_AT_KEY,
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
