import { NetworkStatus, useQuery } from '@apollo/client'
import { getDataFromTree } from '@apollo/client/react/ssr'
import type { NextPage } from 'next'
import { useState, useEffect } from 'react'
import { QUERY, QUERY_INDEX } from '../helpers'
import withApollo from '../attempts/with-apollo'

const Third: React.FC = () => {
  const { data, loading, networkStatus, error, refetch } = useQuery(QUERY_INDEX, {
    // notifyOnNetworkStatusChange: true
  })

  if (loading) return <div>Loading...</div>

  return (
    <div>
      <p>
        This page's data was fetched on the <strong>{false ? 'Next.js server' : 'client'}</strong>.
      </p>
      {JSON.stringify(data)}
    </div>
  )
}

export default withApollo(Third, { getDataFromTree })
