import { NhostGraphqlClient } from '../../src'
import schema from '../schemas/hasura'
const client = new NhostGraphqlClient({ schema, url: '' })

client.query.todos()

const invalidProperty = async () => {
  const [todo] = await client.query.todos({
    select: {
      userId: true,
      category: true,
      // TODO: this should not be allowed. In the meantime, it is not included in the generated query nor the result type
      unexistingProperty: 43
    }
  })

  todo.userId
  // @ts-expect-error
  todo.contents
  // @ts-expect-error
  todo.unexistingProperty
}
