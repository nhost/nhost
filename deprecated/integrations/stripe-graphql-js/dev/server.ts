import { createServer } from 'http'
import { Context, createStripeGraphQLServer } from '../src/index'

const isAllowed = (stripeCustomerId: string, context: Context) => {
  const { isAdmin } = context

  if (isAdmin) {
    return true
  }

  return false
}

const yoga = createStripeGraphQLServer({
  isAllowed,
  graphiql: true
})

const server = createServer(yoga)

server.listen(4000, () => {
  console.info('Stripe GraphQL API server is running on http://localhost:4000')
})
