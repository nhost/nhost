import { createStripeGraphQLServer } from '../src/index'

const server = createStripeGraphQLServer({
  context: (context) => {
    return {
      ...context
    }
  }
})

server.start()
