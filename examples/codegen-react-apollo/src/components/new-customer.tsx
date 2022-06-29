import { useState } from 'react'
import { useInsertCustomerMutation } from '../utils/__generated__/graphql'

export function NewCustomer() {
  const [name, setName] = useState('')

  const [insertCustomer, { loading }] = useInsertCustomerMutation()

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()

    try {
      await insertCustomer({
        variables: {
          customer: {
            name
          }
        }
      })
    } catch (error) {
      return alert(`error: ${error}`)
    }

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
          <div>
            <button type="submit" disabled={loading}>
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
