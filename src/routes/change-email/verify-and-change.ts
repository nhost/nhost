import { Response, Router } from 'express'
import { asyncWrapper, rotateTicket, selectAccountByTicket } from '@/helpers'
import { changeEmailByTicket } from '@/queries'

import { request } from '@/request'
import { VerifySchema, verifySchema } from '@/validation'
import { AccountData, UpdateAccountData } from '@/types'
import { v4 as uuidv4 } from 'uuid'
import { APPLICATION, AUTHENTICATION } from '@config/index'
import { emailClient } from '@/email'
import { ValidatedRequest, ValidatedRequestSchema, ContainerTypes, createValidator } from 'express-joi-validation'

async function changeEmail(req: ValidatedRequest<Schema>, res: Response): Promise<unknown> {
  if(!AUTHENTICATION.VERIFY_EMAILS) {
    return res.boom.notImplemented(`Please set the VERIFY_EMAILS env variable to true to use the auth/change-email/change route`)
  }

  const { ticket } = req.body

  const account = await selectAccountByTicket(ticket)

  if(!account) {
    req.logger.verbose(`User tried changing his email but provided an invalid ticket ${ticket}`, {
      ticket
    })
    return res.boom.badRequest('Account with such ticket does not exist')
  }

  const { email, new_email, user } = account

  const hasuraData = await request<UpdateAccountData>(changeEmailByTicket, {
    ticket,
    new_email,
    now: new Date(),
    new_ticket: uuidv4()
  })

  if (!hasuraData.update_auth_accounts.affected_rows) {
    return res.boom.unauthorized('Invalid or expired ticket')
  }

  if (AUTHENTICATION.NOTIFY_EMAIL_CHANGE && APPLICATION.EMAILS_ENABLED) {
    await emailClient.send({
      template: 'notify-email-change',
      locals: {
        url: APPLICATION.SERVER_URL,
        locale: account.locale,
        app_url: APPLICATION.APP_URL,
        display_name: user.display_name
      },
      message: {
        to: email
      }
    })
  }
  await rotateTicket(ticket)

  req.logger.verbose(`User ${user.id}(ticket: ${ticket}) changed his email to ${new_email}`, {
    user_id: user.id,
    new_email,
    ticket
  })


  return res.status(204).send()
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: VerifySchema
}

export default (router: Router) => {
  router.post('/change', createValidator().body(verifySchema), asyncWrapper(changeEmail))
}