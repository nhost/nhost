import { NhostSession } from '@nhost/react'
import { GetServerSidePropsContext } from 'next'
import { createServerSideClient } from './create-server-side-client'

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
  context: GetServerSidePropsContext
): Promise<NhostSession | null> => {
  const nhost = await createServerSideClient(backendUrl, context)
  const { accessToken, refreshToken, user } = nhost.auth.client.interpreter!.getSnapshot().context
  return nhost.auth.isAuthenticated()
    ? {
        accessToken: accessToken.value!,
        accessTokenExpiresIn: (accessToken.expiresAt!.getTime() - Date.now()) / 1_000,
        refreshToken: refreshToken.value!,
        user: user!
      }
    : null
}
