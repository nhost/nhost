import React, { useEffect, useState } from 'react'
import { useQuery, NetworkStatus } from '@apollo/client'
import { QUERY } from '../helpers'
import withApollo from '../attempts/with-apollo'
import { getDataFromTree } from '@apollo/client/react/ssr'

const RefetchPage: React.FC = () => {
  const { data, loading, networkStatus, error, refetch } = useQuery(QUERY, {
    notifyOnNetworkStatusChange: true
  })

  const [cached, setCached] = useState(true)
  useEffect(() => {
    if (networkStatus !== NetworkStatus.ready) setCached(false)
  }, [networkStatus])

  if (loading) return <div>'Loading...</div>

  return (
    <div>
      <p>
        This page's data was fetched on the <strong>{cached ? 'Next.js server' : 'client'}</strong>.
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

      {JSON.stringify(data)}
    </div>
  )
}
export default withApollo(RefetchPage, { getDataFromTree })
