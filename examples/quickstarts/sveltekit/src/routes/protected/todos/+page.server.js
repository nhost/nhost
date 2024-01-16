import { getNhost } from '$lib/nhost'
import gql from 'graphql-tag'

/** @type {import('./$types').PageServerLoad} */
export const load = async ({ url, cookies }) => {
  const nhost = await getNhost(cookies)
  const page = parseInt(url.searchParams.get('page') || '0')

  const {
    data: {
      todos,
      todos_aggregate: {
        aggregate: { count }
      }
    }
  } = await nhost.graphql.request(
    gql`
      query getTodos($limit: Int, $offset: Int) {
        todos(limit: $limit, offset: $offset, order_by: { createdAt: desc }) {
          id
          title
          done
          attachment {
            id
          }
        }

        todos_aggregate {
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
    /** @type {import('$lib/types').Todo[]} */
    todos,

    /** @type number */
    count,

    /** @type number */
    page
  }
}
