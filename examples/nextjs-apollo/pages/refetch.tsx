import React, { useEffect, useState } from 'react'

import { NetworkStatus, useQuery } from '@apollo/client'
import { getDataFromTree } from '@apollo/client/react/ssr'

import { QUERY, withApollo, withNhost } from '../helpers'

const RefetchPage: React.FC = () => {
  const { data, loading, networkStatus, refetch } = useQuery(QUERY, {
    notifyOnNetworkStatusChange: true
  })
  const [cached, setCached] = useState(true)
  useEffect(() => {
    if (networkStatus !== NetworkStatus.ready) setCached(false)
  }, [networkStatus])

  if (loading) return <div>Loading...</div>

  return (
    <div>
      <p>
        This page&apos;s data was fetched on the{' '}
        <strong>{cached ? 'Next.js server' : 'client'}</strong>.
        <br />
        Network Status: <strong>{networkStatus}</strong>{' '}
        <button
          onClick={() =>
            refetch({
              fetchPolicy: 'network-only'
            })
          }
        >
          Refetch
        </button>
      </p>
      <ul>
        {data?.test.map((item) => (
          <li key={item.id}>{item.id}</li>
        ))}
      </ul>
    </div>
  )
}
export default withApollo(withNhost(RefetchPage), { getDataFromTree })
