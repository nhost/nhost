import { gql } from '@apollo/client'
import PatItem, { type PAT } from '@components/pat-item'
import withAuthAsync from '@utils/auth-guard'
import { getNhost } from '@utils/nhost'
import Head from 'next/head'
import Link from 'next/link'

const PATs = async ({
  params
}: {
  params: {
    [key: string]: string | string[] | undefined
  }
}) => {
  const page = parseInt(params.pagination?.at(0) || '0')
  const nhost = await getNhost()

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

  return (
    <div className="flex flex-col space-y-4">
      <Head>
        <title>Personal Access Tokens</title>
      </Head>

      <div className="flex items-center justify-between w-full">
        <h2 className="text-xl">Personal Access Tokens ({count})</h2>

        <Link
          href={`/protected/pat/new`}
          className="px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
        >
          Add a PAT
        </Link>
      </div>

      <ul className="space-y-1">
        {authRefreshTokens.map((token: PAT) => (
          <li key={token.id}>
            <PatItem pat={token} />
          </li>
        ))}
      </ul>

      {count > 10 && (
        <div className="flex justify-center space-x-2">
          {page > 0 && (
            <Link
              href={`/protected/pat/${page - 1}`}
              className="px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
            >
              Previous
            </Link>
          )}

          {page + 1 < Math.ceil(count / 10) && (
            <Link
              href={`/protected/pat/${page + 1}`}
              className="px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

export default withAuthAsync(PATs)
