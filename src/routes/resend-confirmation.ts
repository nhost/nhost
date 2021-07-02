import { APPLICATION, REGISTRATION } from '@config/index'
import { Response, Router } from 'express'
import { asyncWrapper, getUser } from '@/helpers'

import { emailClient } from '@/email'
import { v4 as uuidv4 } from 'uuid'
import { Session } from '@/types'
import { ContainerTypes, createValidator, ValidatedRequest, ValidatedRequestSchema } from 'express-joi-validation'
import { ResendConfirmationSchema, resendConfirmationSchema } from '@/validation'
import { gqlSdk } from '@/utils/gqlSDK'

async function resendConfirmation(req: ValidatedRequest<Schema>, res: Response): Promise<unknown> {
  if (REGISTRATION.AUTO_ACTIVATE_NEW_USERS) {
    return res.boom.notImplemented(`Please set the AUTO_ACTIVATE_NEW_USERS env variable to false to use the auth/resend-confirmation route`)
  }

  const { email } = req.body

  const user = await getUser(email)

  if (!user) {
    req.logger.verbose(`User tried resending confirmation email to ${email} but no user with such email exists`, {
      email,
    })
    return res.boom.badRequest('Account does not exist')
  } else if (user.active) {
    req.logger.verbose(`User ${user.id} tried resending confirmation email to ${email} but his user is already active`, {
      userId: user.id,
      email,
    })
    return res.boom.badRequest('Account already activated')
  } else if (
    +new Date(user.lastConfirmationEmailSentAt) + REGISTRATION.CONFIRMATION_RESET_TIMEOUT > +new Date()
  ) {
    req.logger.verbose(`User ${user.id} tried resending confirmation email to ${email} but he is timed out`, {
      userId: user.id,
      email,
      lastConfirmationEmailSentAt: user.lastConfirmationEmailSentAt,
      timeout: REGISTRATION.CONFIRMATION_RESET_TIMEOUT
    })
    return res.boom.badRequest('Please wait before resending the confirmation email')
  }

  const ticket = uuidv4()
  const now = new Date()
  const ticketExpiresAt = new Date()
  ticketExpiresAt.setTime(now.getTime() + 60 * 60 * 1000) // active for 60 minutes

  if (!APPLICATION.EMAILS_ENABLED) {
    throw new Error('SMTP settings unavailable')
  }

  const displayName = user.displayName || user.email

  await emailClient.send({
    template: 'activate-user',
    message: {
      to: user.email,
      headers: {
        'x-ticket': {
          prepared: true,
          value: ticket
        }
      }
    },
    locals: {
      displayName,
      ticket,
      url: APPLICATION.SERVER_URL,
      locale: user.locale
    }
  })

  // update last sent confirmation, ticket
  await gqlSdk.updateUser({
    id: user.id,
    user: {
      lastConfirmationEmailSentAt: new Date(+Date.now() + REGISTRATION.CONFIRMATION_RESET_TIMEOUT),
      ticket,
      ticketExpiresAt
    }
  })

  const session: Session = {
    jwtToken: null,
    jwtExpiresIn: null,
    user: {
      id: user.id,
      displayName,
      email: user.email,
      avatarUrl: user.avatarUrl
    }
  }

  req.logger.verbose(`User ${user.id} requested a confirmation email reset to ${user.email}`, {
    userId: user.id,
    email: user.email,
  })

  return res.send(session)
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: ResendConfirmationSchema
}

export default (router: Router) => {
  router.post('/resend-confirmation', createValidator().body(resendConfirmationSchema), asyncWrapper(resendConfirmation))
}
