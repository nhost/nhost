import { useState } from 'react'
import { queryClient } from '../utils/react-query-client'
import { useInsertCustomerMutation } from '../utils/__generated__/graphql'

export function NewCustomer() {
  const [name, setName] = useState('')

  const { mutate, isLoading, isError, error } = useInsertCustomerMutation({
    onSuccess: () => {
      queryClient.invalidateQueries('GetCustomers')
    }
  })

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()

    try {
      await mutate({
        customer: {
          name
        }
      })
    } catch (error) {
      return console.error(error)
    }

    setName('')

    alert('Customer added!')
  }

  return (
    <div>
      <h2>New Customer</h2>
      <div>
        <form onSubmit={handleSubmit}>
          <div>
            <input
              type="text"
              name="name"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {isError && <div>Error: {JSON.stringify(error, null, 2)}</div>}
          <div>
            <button type="submit" disabled={isLoading}>
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
