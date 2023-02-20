import { NhostGraphqlClient } from '../../src'
import schema from '../schemas/hasura'
const client = new NhostGraphqlClient({ schema, url: '' })

const enums = async () => {
  // * Select all scalar fields
  const fullTodos = await client.query.todos({
    variables: { where: { category: { _eq: 'essay' } } }
  })
  const firstFullTodo = fullTodos[0]
  firstFullTodo.category
  firstFullTodo.category = 'essay'
  firstFullTodo.category = 'novel'
  // @ts-expect-error
  firstFullTodo.category = 'value not in enum'

  // * Pick only one field
  const restrictedTodos = await client.query.todos({
    variables: { where: { category: { _eq: 'essay' } } },
    select: { category: true }
  })
  const firstRestrictedTodo = restrictedTodos[0]
  firstRestrictedTodo.category
  firstRestrictedTodo.category = 'essay'
  firstRestrictedTodo.category = 'novel'
  // @ts-expect-error
  firstRestrictedTodo.category = 'value not in enum'

  // * Make a query with an enum value not in the enum
  client.query.todos({
    variables: {
      where: {
        category: {
          // @ts-expect-error
          _eq: 'value not in enum'
        }
      }
    }
  })
}
