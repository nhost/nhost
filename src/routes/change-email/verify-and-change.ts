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
    return res.boom.badImplementation(`Please set the VERIFY_EMAILS env variable to true to use the auth/change-email/change route.`)
  }

  const { ticket } = req.body

  let email: AccountData['email']
  let new_email: AccountData['new_email']
  let user: AccountData['user']
  let account: AccountData

  try {
    account = await selectAccountByTicket(ticket)
    email = account.email
    new_email = account.new_email
    user = account.user
  } catch(err) {
    return res.boom.badRequest(err.message);
  }

  const hasuraData = await request<UpdateAccountData>(changeEmailByTicket, {
    ticket,
    new_email,
    now: new Date(),
    new_ticket: uuidv4()
  })

  if (!hasuraData.update_auth_accounts.affected_rows) {
    return res.boom.unauthorized('Invalid or expired ticket.')
  }

  if (AUTHENTICATION.NOTIFY_EMAIL_CHANGE && APPLICATION.EMAILS_ENABLED) {
    try {
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
    } catch (err) {
      console.error('Unable to send email')
      console.error(err)
      return res.boom.badImplementation()
    }
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