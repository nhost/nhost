import { NextPageContext } from 'next'
import React from 'react'

import { NhostSession } from '@nhost/core'
import { getNhostSession, useAccessToken, useAuthenticated, useUserData } from '@nhost/nextjs'

import { BACKEND_URL } from '../helpers'

export async function getServerSideProps(context: NextPageContext) {
  const nhostSession = await getNhostSession(BACKEND_URL, context)
  return {
    props: {
      nhostSession
    }
  }
}

const SecondPage: React.FC<{ initial: NhostSession }> = () => {
  const isAuthenticated = useAuthenticated()
  const user = useUserData()
  const accessToken = useAccessToken()
  if (!isAuthenticated) return <div>User it not authenticated</div>
  return (
    <div>
      <h1>Second page</h1>
      User {user?.displayName} is authenticated {isAuthenticated ? 'yes' : 'no'}
      <div>Access token: {accessToken}</div>
    </div>
  )
}

export default SecondPage
