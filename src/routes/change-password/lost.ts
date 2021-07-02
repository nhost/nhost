import { Response, Router } from 'express'
import { v4 as uuidv4 } from 'uuid'

import { asyncWrapper, getUserByEmail } from '@/helpers'
import { APPLICATION, AUTHENTICATION } from '@config/index'
import { emailClient } from '@/email'
import { ForgotSchema, forgotSchema } from '@/validation'
import { ValidatedRequestSchema, ContainerTypes, createValidator, ValidatedRequest } from 'express-joi-validation'
import { gqlSdk } from '@/utils/gqlSDK'

/**
 * * Creates a new temporary ticket in the user, and optionnaly send the link by email
 */
async function requestChangePassword(req: ValidatedRequest<Schema>, res: Response): Promise<unknown> {
  if(!AUTHENTICATION.LOST_PASSWORD_ENABLED) {
    return res.boom.notImplemented(`Please set the LOST_PASSWORD_ENABLE env variable to true to use the auth/change-password/request route`)
  }

  // smtp must be enabled for request change password to work.
  if (!APPLICATION.EMAILS_ENABLED) {
    throw new Error('SMTP settings unavailable')
  }

  const { email } = req.body

  const user = await getUserByEmail(email)

  if (!user || !user.active) {
    req.logger.verbose(`User tried requesting email change for ${email} but no user with such email exists`, {
      email
    })
    return res.boom.badRequest('No active user with such email exists')
  }

  const ticket = uuidv4()
  const now = new Date()
  const ticketExpiresAt = new Date()

  // ticket active for 60 minutes
  ticketExpiresAt.setTime(now.getTime() + 60 * 60 * 1000)

  await gqlSdk.updateUser({
    id: user.id,
    user: {
      ticket,
      ticketExpiresAt
    }
  })

  await emailClient.send({
    template: 'lost-password',
    locals: {
      ticket,
      url: APPLICATION.SERVER_URL,
      locale: user.locale,
      appUrl: APPLICATION.APP_URL,
      displayName: user.displayName
    },
    message: {
      to: email,
      headers: {
        'x-ticket': {
          prepared: true,
          value: ticket as string
        }
      }
    }
  })

  req.logger.verbose(`User ${user.id} requested a lost password`, {
    userId: user.id
  })

  return res.status(204).send()
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: ForgotSchema
}

export default (router: Router) => {
  router.post('/request', createValidator().body(forgotSchema), asyncWrapper(requestChangePassword))
}
