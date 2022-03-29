import { NextPageContext } from 'next'
import React from 'react'

import { NhostSession } from '@nhost/core'
import { getNhostSession, useAccessToken } from '@nhost/nextjs'

import { authProtected } from '../components/protected-route'
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
  return (
    <div>
      <h1>SSR page only accessible to authenticated users</h1>
      <div>Access token: {accessToken}</div>
    </div>
  )
}

export default authProtected(RefetchPage)
