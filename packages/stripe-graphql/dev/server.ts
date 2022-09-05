import { createStripeGraphQLServer } from '../src/index'
import * as dotenv from 'dotenv'
dotenv.config()

const server = createStripeGraphQLServer({
  context: () => {
    return {}
  }
})

server.start()
