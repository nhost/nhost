import { NhostSession } from '@nhost/react'
import { GetServerSidePropsContext } from 'next'
import { createServerSideClient, CreateServerSideClientParams } from './create-server-side-client'

/**
 * Refreshes the access token if there is any and returns the Nhost session.
 *
 * @example
 * ### Using an arrow function
 *
 * ```js
 * export const getServerSideProps: GetServerSideProps = async (context) => {
 *   const nhostSession = await getNhostSession(
 *     { subdomain: '<project_subdomain>', region: '<project_region>' },
 *     context
 *   )
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
 *   const nhostSession = await getNhostSession(
 *     { subdomain: '<project_subdomain>', region: '<project_region>' },
 *     context
 *   )
 *
 *   return {
 *     props: {
 *       nhostSession
 *     }
 *   }
 * }
 * ```
 *
 * @param subdomain - URL of your Nhost application
 * @param region - Region of your Nhost application
 * @param context - Next.js context
 * @returns Nhost session
 */
export const getNhostSession = async (
  params: CreateServerSideClientParams,
  context: GetServerSidePropsContext
): Promise<NhostSession | null> => {
  const nhost = await createServerSideClient(params, context)
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
