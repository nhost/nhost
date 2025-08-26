import { createYoga, YogaInitialContext } from 'graphql-yoga'

import { schema } from './schema'
import { Context, CreateServerProps } from './types'
import { getUserClaims } from './utils'

const createStripeGraphQLServer = ({
  cors,
  isAllowed,
  graphiql,
  maskedErrors = true
}: CreateServerProps = {}) => {
  const context = (context: YogaInitialContext): Context => {
    const { request } = context

    // user id
    const userClaims = getUserClaims(request)

    // check if using correct `x-hasura-admin-secret` header
    const adminSecretFromHeader = request.headers.get('x-hasura-admin-secret')
    const adminSecret = process.env.NHOST_ADMIN_SECRET

    // check if the request is from Hasura
    const nhostWebhookSecretFromHeader = request.headers.get('x-nhost-webhook-secret')
    const nhostWebhookSecret = process.env.NHOST_WEBHOOK_SECRET
    const role = request.headers.get('x-hasura-role')

    // variables
    const isAdmin =
      adminSecretFromHeader === adminSecret ||
      (role === 'admin' && nhostWebhookSecretFromHeader === nhostWebhookSecret)

    // if no isAllowed function is provided, we will allow admin requests
    const isAllowedFunction =
      isAllowed ||
      ((_stripeCustomerId: string, context: Context) => {
        return context.isAdmin
      })

    // return
    return {
      ...context,
      isAllowed: isAllowedFunction,
      userClaims,
      isAdmin
    }
  }

  const yoga = createYoga({
    cors,
    graphiql,
    context,
    schema,
    graphqlEndpoint: '*',
    maskedErrors
  })

  return yoga
}

export { createStripeGraphQLServer, schema }
