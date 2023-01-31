import { Context, createStripeGraphQLServer } from '../src/index'

const isAllowed = (stripeCustomerId: string, context: Context) => {
  const { isAdmin } = context

  if (isAdmin) {
    return true
  }

  return false
}

const server = createStripeGraphQLServer({
  isAllowed,
  graphiql: true
})

server.listen(4000, () => {
  console.info('Stripe GraphQL API server is running on http://localhost:4000')
})
