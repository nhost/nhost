import { GraphQLClient, nhostFunction } from '../src'
import { getSdk } from './_sdk'

const client = new GraphQLClient()
const { activeUsers } = getSdk(client)

export default nhostFunction(async (req, res) => {
  const { users } = await activeUsers()
  res.json(users)
})
