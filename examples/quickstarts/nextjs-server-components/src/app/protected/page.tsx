'use server'

import { gql } from '@apollo/client'
import { getNhost } from '@utils/nhost'
import Head from 'next/head'

interface File {
  id: string
  name: string
}

export default async function Protected() {
  const nhost = await getNhost()
  const user = nhost.auth.getUser()

  const {
    data: { files }
  } = await nhost.graphql.request(gql`
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

      <p>Showing {files.length} files</p>

      <ul>
        {files.map((file: File) => (
          <li key={file.id}>{file.name}</li>
        ))}
      </ul>
    </>
  )
}
