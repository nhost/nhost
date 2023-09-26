import { gql } from '@apollo/client'
import PatItem, { type PAT } from '@components/pat-item'
import { getNhost } from '@utils/nhost'
import Head from 'next/head'
import Link from 'next/link'

export default async function PAT({
  params
}: {
  params: { [key: string]: string | string[] | undefined }
}) {
  const page = parseInt(params.pagination?.at(0) || '0')
  const nhost = await getNhost()

  const {
    data: { authRefreshTokens }
  } = await nhost.graphql.request(
    gql`
      query getPersonalAccessTokens($offset: Int, $limit: Int) {
        authRefreshTokens(where: { type: { _eq: pat } }, offset: $offset, limit: $limit) {
          id
          type
          metadata
          expiresAt
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
        <h2 className="text-xl">Personal Access Tokens</h2>

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
    </div>
  )
}
