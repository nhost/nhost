import { useQuery } from '@apollo/client'
import { getDataFromTree } from '@apollo/client/react/ssr'
import { QUERY_INDEX, withApollo } from '../helpers'

const Third: React.FC = () => {
  const { data, loading } = useQuery(QUERY_INDEX, {
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
