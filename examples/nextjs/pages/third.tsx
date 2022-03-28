import { NextPageContext } from 'next'
import React from 'react'

import { NhostSession } from '@nhost/core'
import { getNhostSession, useAccessToken, useAuthenticated } from '@nhost/nextjs'

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
  const accessToken = useAccessToken()
  const isAuthenticated = useAuthenticated()
  if (!isAuthenticated) return <div>User it not authenticated </div>
  return (
    <div>
      <h1>Third page</h1>
      User is authenticated: {isAuthenticated ? 'yes' : 'no'}
      <div>Access token: {accessToken}</div>
    </div>
  )
}

export default RefetchPage
