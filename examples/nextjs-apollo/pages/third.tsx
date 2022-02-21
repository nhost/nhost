import { NextPageContext } from 'next'
import React from 'react'

import { getNhostSession, NhostSession } from '@nhost/nextjs'
import { useAccessToken, useAuthenticated } from '@nhost/react'

import { BACKEND_URL } from '../helpers'

export async function getServerSideProps(context: NextPageContext) {
  const nhostSession = await getNhostSession(BACKEND_URL, context)
  return {
    props: {
      nhostSession
    }
  }
}

const RefetchPage: React.FC<{ initial: NhostSession }> = () => {
  const jwt = useAccessToken()
  const authenticated = useAuthenticated()
  if (!authenticated) return <div>User it not authenticated </div>
  return (
    <div>
      <h1>THIRD User is authenticated {authenticated ? 'OUI' : 'NON'}</h1>
      <div>JWT: {jwt}</div>
    </div>
  )
}

export default RefetchPage
