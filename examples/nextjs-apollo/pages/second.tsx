import { NextPageContext } from 'next'
import React from 'react'

import { getNhostSession, NhostSession } from '@nhost/nextjs'
import { useAccessToken, useAuthenticated, useUserData } from '@nhost/react'

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
  const jwt = useAccessToken()
  if (!isAuthenticated) return <div>User it not authenticated</div>
  return (
    <div>
      <h1>
        SECOND User {user?.displayName} is authenticated {isAuthenticated ? 'OUI' : 'NON'}
      </h1>
      <div>JWT: {jwt}</div>
    </div>
  )
}

export default SecondPage
