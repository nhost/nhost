import { useGetCustomersQuery } from '../utils/__generated__/graphql'

export function Customers() {
  const { data, loading, error } = useGetCustomersQuery()

  if (loading || !data) {
    return <div>Loading</div>
  }

  if (error) {
    return <div>Error</div>
  }

  const { customers } = data

  return (
    <div>
      <h2>Customers</h2>
      <ul>
        {customers.map((customer) => (
          <li key={customer.id}>{customer.name}</li>
        ))}
      </ul>
    </div>
  )
}
