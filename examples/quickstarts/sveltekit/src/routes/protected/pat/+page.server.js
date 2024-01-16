import { getNhost } from '$lib/nhost'
import gql from 'graphql-tag'

/** @type {import('./$types').PageServerLoad} */
export const load = async ({ url, cookies }) => {
  const nhost = await getNhost(cookies)
  const page = parseInt(url.searchParams.get('page') || '0')

  const {
    data: {
      authRefreshTokens,
      authRefreshTokensAggregate: {
        aggregate: { count }
      }
    }
  } = await nhost.graphql.request(
    gql`
      query getPersonalAccessTokens($offset: Int, $limit: Int) {
        authRefreshTokens(
          offset: $offset
          limit: $limit
          order_by: { createdAt: desc }
          where: { type: { _eq: pat } }
        ) {
          id
          metadata
          type
          expiresAt
        }

        authRefreshTokensAggregate(where: { type: { _eq: pat } }) {
          aggregate {
            count
          }
        }
      }
    `,
    {
      offset: page * 10,
      limit: 10
    }
  )

  return {
    /** @type {import('$lib/types').PersonalAccessToken[]} */
    personalAccessTokens: authRefreshTokens,

    /** @type number */
    count,

    /** @type number */
    page
  }
}
