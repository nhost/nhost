import jwt from 'jsonwebtoken'
import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY env var is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2022-08-01'
})

export const getUserId = (req: Request): string | undefined => {
  try {
    const authorizationHeader = req.headers.get('authorization')

    const accessToken = authorizationHeader?.split(' ')[1]

    if (!accessToken) {
      return undefined
    }

    const jwtSecret = JSON.parse(process.env.NHOST_JWT_SECRET!)

    const decodedToken = jwt.verify(accessToken, jwtSecret.key) as any
    const hasuraScope = decodedToken['https://hasura.io/jwt/claims']

    // ['https://hasura.io/jwt/claims']

    if (!hasuraScope || !hasuraScope['x-hasura-user-id']) {
      return undefined
    }

    return hasuraScope['x-hasura-user-id'] as string
  } catch (error) {
    return undefined
  }
}
