import { Response, Router } from 'express'
import { v4 as uuidv4 } from 'uuid'

import { asyncWrapper, getUserByEmail } from '@/helpers'
import { APPLICATION, AUTHENTICATION } from '@config/index'
import { emailClient } from '@/email'
import { ForgotSchema, forgotSchema } from '@/validation'
import {
  ValidatedRequestSchema,
  ContainerTypes,
  createValidator,
  ValidatedRequest
} from 'express-joi-validation'
import { gqlSDK } from '@/utils/gqlSDK'

/**
 * * Creates a new temporary ticket in the account, and optionnaly send the link by email
 * Always return status code 204 in order to not leak information about emails in the database
 */
async function requestChangePassword(
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> {
  if (!AUTHENTICATION.LOST_PASSWORD_ENABLED) {
    return res.boom.badImplementation(
      `Please set the LOST_PASSWORD_ENABLE env variable to true to use the auth/change-password/request route.`
    )
  }

  // smtp must be enabled for request change password to work.
  if (!APPLICATION.EMAILS_ENABLED) {
    return res.boom.badImplementation('SMTP settings unavailable')
  }

  const { email } = req.body

  const user = await getUserByEmail(email)

  if (!user) {
    console.error('Account does not exist')
    // TODO: Do we really want to return 204 here?
    return res.status(204).send()
  }

  if (!user.active) {
    console.error('Account is not active')
    // TODO: Do we really want to return 204 here?
    return res.status(204).send()
  }

  // generate new ticket and ticket_expires_at
  const ticket = uuidv4()
  const now = new Date()
  const ticketExpiresAt = new Date()

  // ticket active for 60 minutes
  ticketExpiresAt.setTime(now.getTime() + 60 * 60 * 1000)

  await gqlSDK.updateUser({
    id: user.id,
    user: {
      ticket,
      ticketExpiresAt
    }
  })

  // send email
  try {
    await emailClient.send({
      template: 'lost-password',
      locals: {
        ticket,
        url: APPLICATION.SERVER_URL,
        locale: user.locale,
        app_url: APPLICATION.APP_URL,
        display_name: user.displayName
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
  } catch (err) {
    console.error('Unable to send email')
    console.error(err)
    return res.status(204).send()
  }

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
