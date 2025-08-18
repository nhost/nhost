import jwt from 'jsonwebtoken'
import Stripe from 'stripe'

import { UserHasuraClaims } from './types'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY env var is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2022-11-15'
})

export const getUserClaims = (req: Request): UserHasuraClaims | undefined => {
  try {
    const authorizationHeader = req.headers.get('authorization')

    const accessToken = authorizationHeader?.split(' ')[1]

    if (!accessToken) {
      return undefined
    }

    if (!process.env.NHOST_JWT_SECRET) {
      throw new Error('NHOST_JWT_SECRET env var is not set')
    }

    const jwtSecret = JSON.parse(process.env.NHOST_JWT_SECRET)

    const decodedToken = jwt.verify(accessToken, jwtSecret.key) as any
    return decodedToken['https://hasura.io/jwt/claims'] as UserHasuraClaims
  } catch (error) {
    return undefined
  }
}
