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

server.start()
