import { NhostGraphqlClient } from '../../src'
import schema from '../schemas/hasura'
const client = new NhostGraphqlClient({ schema, url: '' })

client.query.todos()

client.query.todos({
  select: {
    userId: true,
    category: true,

    // TODO: this should not be allowed
    unexistingProperty: 43
  }
})
