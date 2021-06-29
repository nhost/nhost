import { Response, Router } from 'express'
import { v4 as uuidv4 } from 'uuid'

import { setNewTicket, setNewEmail } from '@/queries'
import { APPLICATION, AUTHENTICATION } from '@config/index'
import { emailClient } from '@/email'
import { request } from '@/request'
import { SetNewEmailData } from '@/types'
import { EmailResetSchema, emailResetSchema } from '@/validation'
import { ValidatedRequestSchema, ContainerTypes, createValidator, ValidatedRequest } from 'express-joi-validation'
import { accountWithEmailExists, asyncWrapper, selectAccountByUserId } from '@/helpers'

async function requestChangeEmail(req: ValidatedRequest<Schema>, res: Response): Promise<any> {
  if(!AUTHENTICATION.VERIFY_EMAILS) {
    return res.boom.notImplemented(`Please set the VERIFY_EMAILS env variable to true to use the auth/change-email/request route`)
  }

  const user_id = req.permission_variables?.['user-id']

  const new_email = req.body.new_email

  if(await accountWithEmailExists(new_email)) {
    req.logger.verbose(`User ${user_id} tried directly changing his email to ${new_email} but an account with such email already exists`, {
      user_id,
      email: new_email,
    })
    return res.boom.badRequest('Cannot use this email')
  }

  // smtp must be enabled for request change password to work.
  if (!APPLICATION.EMAILS_ENABLED) {
    throw Error('SMTP settings unavailable')
  }

  const ticket = uuidv4()
  const now = new Date()
  const ticket_expires_at = new Date()

  // ticket active for 60 minutes
  ticket_expires_at.setTime(now.getTime() + 60 * 60 * 1000)


  await request(setNewTicket, {
    user_id,
    ticket,
    ticket_expires_at
  })

  const setNewEmailReturn = await request<SetNewEmailData>(setNewEmail, { user_id, new_email })
  const display_name = setNewEmailReturn.update_auth_accounts.returning[0].user.display_name

  const account = await selectAccountByUserId(user_id)

  await emailClient.send({
    template: 'change-email',
    locals: {
      ticket,
      url: APPLICATION.SERVER_URL,
      locale: account.locale,
      app_url: APPLICATION.APP_URL,
      display_name
    },
    message: {
      to: new_email,
      headers: {
        'x-ticket': {
          prepared: true,
          value: ticket
        }
      }
    }
  })

  req.logger.verbose(`User ${user_id} requested to change his email to ${new_email}`, {
    user_id,
    new_email
  })

  return res.status(204).send()
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: EmailResetSchema
}

export default (router: Router) => {
  router.post('/request', createValidator().body(emailResetSchema), asyncWrapper(requestChangeEmail))
}
