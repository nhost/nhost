import React from 'react'

import { useAccessToken } from '@nhost/nextjs'

import { authProtected } from '../components/protected-route'

const ClientSideAuthPage: React.FC = () => {
  const accessToken = useAccessToken()
  return (
    <div>
      <h1>Client-side rendered page only accessible to authenticated users</h1>
      <div>Access token: {accessToken}</div>
    </div>
  )
}

export default authProtected(ClientSideAuthPage)
