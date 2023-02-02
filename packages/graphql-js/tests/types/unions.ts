import { NhostGraphqlClient } from '../../src'
import schema from '../schemas/hasura'
const client = new NhostGraphqlClient({ schema, url: '' })

client.query.everyone({
  on: {
    Dog: { select: { name: true } },
    Human: {
      select: { firstName: true, pets: { select: { diet: true } } },
      Hamster: true
    }
  }
})
