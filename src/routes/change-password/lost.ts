import { Response, Router } from 'express'
import { v4 as uuidv4 } from 'uuid'

import { asyncWrapper, selectAccountByEmail } from '@/helpers'
import { APPLICATION, AUTHENTICATION } from '@config/index'
import { emailClient } from '@/email'
import { ForgotSchema, forgotSchema } from '@/validation'
import { setNewTicket } from '@/queries'
import { request } from '@/request'
import { ValidatedRequestSchema, ContainerTypes, createValidator, ValidatedRequest } from 'express-joi-validation'

/**
 * * Creates a new temporary ticket in the account, and optionnaly send the link by email
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

  const account = await selectAccountByEmail(email)

  if (!account || !account.active) {
    req.logger.verbose(`User tried requesting email change for ${email} but no account with such email exists`, {
      email
    })
    return res.boom.badRequest('No active account with such email exists')
  }

  const ticket = uuidv4()
  const now = new Date()
  const ticket_expires_at = new Date()

  // ticket active for 60 minutes
  ticket_expires_at.setTime(now.getTime() + 60 * 60 * 1000)

  await request(setNewTicket, {
    user_id: account.user.id,
    ticket,
    ticket_expires_at
  })

  await emailClient.send({
    template: 'lost-password',
    locals: {
      ticket,
      url: APPLICATION.SERVER_URL,
      locale: account.locale,
      app_url: APPLICATION.APP_URL,
      display_name: account.user.display_name
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

  req.logger.verbose(`User ${account.user.id} forgot his password`, {
    user_id: account.user.id,
  })

  return res.status(204).send()
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: ForgotSchema
}

export default (router: Router) => {
  router.post('/request', createValidator().body(forgotSchema), asyncWrapper(requestChangePassword))
}
