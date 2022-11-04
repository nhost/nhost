import { RequestHandler } from 'express'

import { ExpressError } from './errors'

export const webhookGuard: RequestHandler = (req, _, next) => {
  const webhookSecret = req.headers['nhost-webhook-secret']
  if (webhookSecret !== process.env.NHOST_WEBHOOK_SECRET) {
    throw new ExpressError(401, 'unauthorized')
  }
  next()
}
