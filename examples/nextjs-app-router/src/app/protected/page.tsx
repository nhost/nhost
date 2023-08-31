'use client'

import { gql, useQuery } from '@apollo/client'
import { useUserData } from '@nhost/nextjs'
import Head from 'next/head'
import withAuth from '../HOCs/with-auth'

const Protected = () => {
  const user = useUserData()

  const { loading, error, data } = useQuery<{ files: { id: string; name: string }[] }>(gql`
    {
      files {
        id
        name
      }
    }
  `)

  return (
    <>
      <Head>
        <title>Protected Page</title>
      </Head>

      <h1 className="text-2xl font-semibold text-center">
        Hi! You are registered with email: {user?.email}.
      </h1>

      <h2>Files</h2>
      {loading && <p>Loading files...</p>}
      {error && <p>{error.message}</p>}
      {!error && <p>Showing {data?.files.length} files</p>}
      <ul>
        {data?.files.map((file) => (
          <li key={file.id}>{file.name}</li>
        ))}
      </ul>
    </>
  )
}

export default withAuth(Protected)
