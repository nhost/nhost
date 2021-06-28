import { Response, Router } from 'express'
import { v4 as uuidv4 } from 'uuid'

import { APPLICATION, AUTHENTICATION } from '@config/index'
import { emailClient } from '@/email'
import { EmailResetSchema, emailResetSchema } from '@/validation'
import { ValidatedRequestSchema, ContainerTypes, createValidator, ValidatedRequest } from 'express-joi-validation'
import { asyncWrapper, getUserByEmail } from '@/helpers'
import { gqlSDK } from '@/utils/gqlSDK'

async function requestChangeEmail(req: ValidatedRequest<Schema>, res: Response): Promise<any> {
  if(!AUTHENTICATION.VERIFY_EMAILS) {
    return res.boom.badImplementation(`Please set the VERIFY_EMAILS env variable to true to use the auth/change-email/request route.`)
  }

  const userId = req.permission_variables?.['user-id']

  const newEmail = req.body.new_email

  if(await getUserByEmail(newEmail)) {
    return res.boom.badRequest('Cannot use this email')
  }

  // smtp must be enabled for request change password to work.
  if (!APPLICATION.EMAILS_ENABLED) {
    return res.boom.badImplementation('SMTP settings unavailable')
  }

  // generate new ticket and ticket_expires_at
  const ticket = uuidv4()
  const now = new Date()
  const ticketExpiresAt = new Date()
  // ticket active for 60 minutes
  ticketExpiresAt.setTime(now.getTime() + 60 * 60 * 1000)
  // set new ticket

  const { updateUser: user } = await gqlSDK.updateUser({
    id: userId,
    user: {
      ticket,
      ticketExpiresAt,
      newEmail
    }
  })

  if (!user) {
    throw new Error("No user found");
  }

  // const user = await getUser(userId)


  // send email
  try {
    await emailClient.send({
      template: 'change-email',
      locals: {
        ticket,
        url: APPLICATION.SERVER_URL,
        locale: user.locale,
        app_url: APPLICATION.APP_URL,
        displayName: user.displayName,
      },
      message: {
        to: newEmail,
        headers: {
          'x-ticket': {
            prepared: true,
            value: ticket
          }
        }
      }
    })
  } catch (err) {
    console.error('Unable to send email')
    console.error(err)
    return res.boom.badImplementation()
  }

  req.logger.verbose(`User ${userId} requested to change his email to ${newEmail}`, {
    userId,
    newEmail
  })

  return res.status(204).send()
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: EmailResetSchema
}

export default (router: Router) => {
  router.post('/request', createValidator().body(emailResetSchema), asyncWrapper(requestChangeEmail))
}
