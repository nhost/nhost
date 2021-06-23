import { APPLICATION, REGISTRATION } from '@config/index'
import { Response, Router } from 'express'
import { asyncWrapper, selectAccount, updateLastSentConfirmation } from '@/helpers'

import { emailClient } from '@/email'
import { v4 as uuidv4 } from 'uuid'
import { UserData, Session } from '@/types'
import { ContainerTypes, createValidator, ValidatedRequest, ValidatedRequestSchema } from 'express-joi-validation'
import { ResendConfirmationSchema, resendConfirmationSchema } from '@/validation'

async function resendConfirmation(req: ValidatedRequest<Schema>, res: Response): Promise<unknown> {
  if (REGISTRATION.AUTO_ACTIVATE_NEW_USERS) {
    return res.boom.badImplementation(`Please set the AUTO_ACTIVATE_NEW_USERS env variable to false to use the auth/resend-confirmation route.`)
  }

  const body = req.body

  const account = await selectAccount(body)

  if (!account) {
    return res.boom.badRequest('Account does not exist.')
  } else if (account.active) {
    return res.boom.badRequest('Account already activated.')
  } else if (
    +new Date(account.last_confirmation_email_sent_at) + REGISTRATION.CONFIRMATION_RESET_TIMEOUT > +new Date()
  ) {
    return res.boom.badRequest('Please wait before resending the confirmation email.')
  }

  const ticket = uuidv4()
  const now = new Date()
  const ticket_expires_at = new Date()
  ticket_expires_at.setTime(now.getTime() + 60 * 60 * 1000) // active for 60 minutes

  const user: UserData = {
    id: account.user.id,
    display_name: account.user.display_name,
    email: account.email,
    avatar_url: account.user.avatar_url
  }

  if (!APPLICATION.EMAILS_ENABLED) {
    return res.boom.badImplementation('SMTP settings unavailable')
  }

  // use display name from `user_data` if available
  const display_name = user.display_name || user.email;

  try {
    await emailClient.send({
      template: 'activate-account',
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
        display_name,
        ticket,
        url: APPLICATION.SERVER_URL,
        locale: account.locale
      }
    })
  } catch (err) {
    console.error(err)
    return res.boom.badImplementation()
  }

  await updateLastSentConfirmation(account.user.id)

  const session: Session = { jwt_token: null, jwt_expires_in: null, user }

  req.logger.verbose(`User ${user.id} requested a confirmation email reset to ${user.email}`, {
    user_id: user.id,
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
