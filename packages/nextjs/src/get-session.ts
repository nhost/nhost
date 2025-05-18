import { NhostClient, NhostSession } from '@nhost/react'
import { SearchParams } from 'next/dist/server/request/search-params';
import { createServerSideClient, CreateServerSideClientParams } from './create-server-side-client'

export const getNhostSessionFromNhostClient = (nhost: NhostClient): NhostSession | null => {
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

/**
 * Refreshes the access token if there is any and returns the Nhost session.
 *
 * @example
 * ### In a Next.js App Router Page Server Component (e.g., app/some-page/page.tsx)
 *
 * ```js
 * import { getNhostSession } from '@nhost/nextjs';
 *
 * export default async function SomePage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
 *   const nhostSession = await getNhostSession(
 *     { subdomain: '<project_subdomain>', region: '<project_region>' }, // Your Nhost params
 *     await searchParams // Pass the searchParams from the page props
 *   );
 *
 *   if (nhostSession) {
 *     console.log('User is authenticated:', nhostSession.user.displayName);
 *   } else {
 *     console.log('User is not authenticated.');
 *     // Potentially redirect here using next/navigation redirect()
 *   }
 *
 *   return (
 *     <div>
 *       {nhostSession ? <p>Welcome, {nhostSession.user.displayName}</p> : <p>Please log in.</p>}
 *     </div>
 *   );
 * }
 * ```
 *
 * @param params - Nhost connection parameters (e.g., subdomain, region, or specific URLs).
 * @param searchParams - URL search parameters object, typically available in Next.js App Router Page Server Components.
 *                     This will be used by the underlying `createServerSideClient` to look for `refreshToken` in the URL
 * @returns A Promise that resolves to the NhostSession object if the user is authenticated, or null otherwise.
 */
export const getNhostSession = async (
  params: CreateServerSideClientParams,
  searchParams: SearchParams,
): Promise<NhostSession | null> => {
  const nhost = await createServerSideClient(params, searchParams)
  return getNhostSessionFromNhostClient(nhost)
}
