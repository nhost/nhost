import { Response, Router } from 'express'
import { APPLICATION, AUTHENTICATION, REGISTRATION } from "@config/index";
import { asyncWrapper, isCompromisedPassword, hashPassword, userIsAnonymous, userWithEmailExists, deanonymizeUser } from '@/helpers';
import { DeanonymizeSchema, deanonymizeSchema } from '@/validation';
import { emailClient } from '@/email';
import { v4 as uuid4 } from 'uuid'
import { ValidatedRequestSchema, ContainerTypes, createValidator, ValidatedRequest } from 'express-joi-validation';
import { gqlSdk } from '@/utils/gqlSDK';

async function deanonymizeUserHandler(req: ValidatedRequest<Schema>, res: Response): Promise<unknown> {
  const { email, password } = req.body

  if(!AUTHENTICATION.ANONYMOUS_USERS_ENABLED) {
    return res.boom.notImplemented(`Please set the ANONYMOUS_USERS_ENABLED env variable to true to use the auth/deanonymize route`)
  }

  if (!req.permissionVariables || !await userIsAnonymous(req.permissionVariables['user-id'])) {
    return res.boom.unauthorized('Unable to deanonymize user')
  }

  const userId = req.permissionVariables['user-id']

  if(await isCompromisedPassword(password)) {
    req.logger.verbose(`User ${userId} tried deanonymizing his user with email ${email} but provided too weak of a password`, {
      userId,
      email
    })
    return res.boom.badRequest('Password is too weak')
  }

  const passwordHash = await hashPassword(password)

  if (await userWithEmailExists(email)) {
    req.logger.verbose(`User ${userId} tried deanonymizing his user with email ${email} but an user with such email already existed`, {
      userId,
      email
    })
    return res.boom.badRequest('Cannot use this email')
  }

  const {updateUser: user} = await gqlSdk.updateUser({
    id: userId,
    user: {
      email,
      passwordHash
    }
  })

  if(!user) {
    throw new Error('Unable to update user')
  }

  if(REGISTRATION.AUTO_ACTIVATE_NEW_USERS) {
    await deanonymizeUser(user)

    req.logger.verbose(`User ${userId} deanonymized their user with email ${email}`, {
      userId,
      email
    })
  } else {
    const ticket = uuid4()
    const ticketExpiresAt = new Date(+new Date() + 60 * 60 * 1000) // active for 60 minutes

    await gqlSdk.updateUser({
      id: userId,
      user: {
        ticket,
        ticketExpiresAt,
        active: false,
      }
    })

    await emailClient.send({
      template: 'activate-user',
      message: {
        to: user.newEmail,
        headers: {
          'x-ticket': {
            prepared: true,
            value: ticket
          }
        }
      },
      locals: {
        displayName: user.displayName,
        ticket,
        url: APPLICATION.SERVER_URL,
        locale: user.locale
      }
    })
  }

  return res.status(204).send()
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: DeanonymizeSchema
}

export default (router: Router) => {
  router.post('/deanonymize', createValidator().body(deanonymizeSchema), asyncWrapper(deanonymizeUserHandler))
}
