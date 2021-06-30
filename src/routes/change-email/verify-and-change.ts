import { Response, Router } from 'express'
import { asyncWrapper, getUserByTicket, rotateTicket } from '@/helpers'

import { VerifySchema, verifySchema } from '@/validation'
import { v4 as uuidv4 } from 'uuid'
import { APPLICATION, AUTHENTICATION } from '@config/index'
import { emailClient } from '@/email'
import {
  ValidatedRequest,
  ValidatedRequestSchema,
  ContainerTypes,
  createValidator
} from 'express-joi-validation'
import { gqlSDK } from '@/utils/gqlSDK'

async function changeEmail(req: ValidatedRequest<Schema>, res: Response): Promise<unknown> {
  if(!AUTHENTICATION.VERIFY_EMAILS) {
    return res.boom.notImplemented(`Please set the VERIFY_EMAILS env variable to true to use the auth/change-email/change route`)
  }

  const { ticket } = req.body

  const user = await getUserByTicket(ticket)

  if(!user) {
    return res.boom.badRequest('Invalid or expired ticket')
  }

  // set newEmail to email for user
  const { updateUsers } = await gqlSDK.changeEmailByTicket({
    ticket,
    email: user.newEmail,
    newTicket: uuidv4(),
    now: new Date()
  })

  if (!updateUsers?.affected_rows) {
    return res.boom.unauthorized('Invalid or expired ticket.')
  }

  if (AUTHENTICATION.NOTIFY_EMAIL_CHANGE && APPLICATION.EMAILS_ENABLED) {
    await emailClient.send({
      template: 'notify-email-change',
      locals: {
        url: APPLICATION.SERVER_URL,
        locale: user.locale,
        app_url: APPLICATION.APP_URL,
        display_name: user.displayName
      },
      message: {
        to: user.email
      }
    })
  }

  await rotateTicket(ticket)

  req.logger.verbose(`User ${user.id}(ticket: ${ticket}) changed email to ${user.newEmail}`, {
    user_id: user.id,
    newEmail: user.newEmail,
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
