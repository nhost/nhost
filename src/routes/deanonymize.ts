import { Response, Router } from 'express'
import { APPLICATION, AUTHENTICATION, REGISTRATION } from "@config/index";
import { accountIsAnonymous, accountWithEmailExists, asyncWrapper, checkHibp, hashPassword, deanonymizeAccount as deanonymizeAccountHelper, selectAccountByUserId } from "src/helpers";
import { DeanonymizeSchema, deanonymizeSchema } from 'src/validation';
import { RequestExtended } from 'src/types';
import { request } from 'src/request';
import { changeEmailByUserId, changePasswordHashByUserId, deactivateAccount, setNewTicket } from 'src/queries';
import { emailClient } from 'src/email';
import { v4 as uuid4 } from 'uuid'
import { ValidatedRequestSchema, ContainerTypes, createValidator } from 'express-joi-validation';

async function deanonymizeAccount(req: RequestExtended<Schema>, res: Response): Promise<unknown> {
  const { email, password } = req.body

  if(!AUTHENTICATION.ANONYMOUS_USERS_ENABLED) {
    return res.boom.badImplementation(`Please set the ANONYMOUS_USERS_ENABLED env variable to true to use the auth/deanonymize route.`)
  }

  if (!req.permission_variables || !await accountIsAnonymous(req.permission_variables['user-id'])) {
    return res.boom.unauthorized('Unable to deanonymize account')
  }

  try {
    await checkHibp(password)
  } catch (err) {
    return res.boom.badRequest(err.message)
  }

  let passwordHash: string
  try {
    passwordHash = await hashPassword(password)
  } catch (err) {
    return res.boom.internal(err.message)
  }

  if (await accountWithEmailExists(email)) {
    return res.boom.badRequest('Cannot use this email.')
  }

  const user_id = req.permission_variables['user-id']

  await request(changeEmailByUserId, {
    user_id,
    new_email: email
  })

  await request(changePasswordHashByUserId, {
    user_id,
    new_password_hash: passwordHash
  })

  if(REGISTRATION.AUTO_ACTIVATE_NEW_USERS) {
    await deanonymizeAccountHelper(
      await selectAccountByUserId(user_id),
    )
  } else {
    const ticket = uuid4() // will be decrypted on the auth/activate call
    const ticket_expires_at = new Date(+new Date() + 60 * 60 * 1000) // active for 60 minutes

    await request(setNewTicket, {
      user_id,
      ticket,
      ticket_expires_at
    })

    await request(deactivateAccount, {
      user_id
    })

    const account = await selectAccountByUserId(user_id)

    await emailClient.send({
      template: 'activate-account',
      message: {
        to: email,
        headers: {
          'x-ticket': {
            prepared: true,
            value: ticket
          }
        }
      },
      locals: {
        display_name: email,
        ticket,
        url: APPLICATION.SERVER_URL,
        locale: account.locale
      }
    })
  }

  return res.status(204).send()
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: DeanonymizeSchema
}

export default (router: Router) => {
  router.post('/deanonymize', createValidator().body(deanonymizeSchema), asyncWrapper(deanonymizeAccount))
}
