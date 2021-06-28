import { Response, Router } from 'express'
import { APPLICATION, AUTHENTICATION, REGISTRATION } from "@config/index";
import { asyncWrapper, checkHibp, hashPassword,  getUserByEmail, deanonymizeUser, userIsAnonymous } from '@/helpers';
import { DeanonymizeSchema, deanonymizeSchema } from '@/validation';
import { emailClient } from '@/email';
import { v4 as uuid4 } from 'uuid'
import { ValidatedRequestSchema, ContainerTypes, createValidator, ValidatedRequest } from 'express-joi-validation';
import { gqlSDK } from '@/utils/gqlSDK';

async function deanonymizeUserHandler(req: ValidatedRequest<Schema>, res: Response): Promise<unknown> {
  const { email: newEmail, password } = req.body

  if(!AUTHENTICATION.ANONYMOUS_USERS_ENABLED) {
    return res.boom.badImplementation(`Please set the ANONYMOUS_USERS_ENABLED env variable to true to use the auth/deanonymize route.`)
  }

  if (!req.permission_variables || !await userIsAnonymous(req.permission_variables['user-id'])) {
    return res.boom.unauthorized('Unable to deanonymize account')
  }

  try {
    await checkHibp(password)
  } catch (err) {
    return res.boom.badRequest(err.message)
  }

  const passwordHash = await hashPassword(password)

  if (await getUserByEmail(newEmail)) {
    return res.boom.badRequest('Cannot use this email.')
  }

  const userId = req.permission_variables['user-id']

  const { user: currentUser } = await gqlSDK.user({
    id: userId,
  })

  if (!currentUser?.active) {
    throw new Error("User is not active");
  }


  const { updateUser: user } = await gqlSDK.updateUser({
    id: userId,
    user: {
      newEmail,
      passwordHash
    }
  })

  if (!user) {
    throw new Error("Could not set new email and password for user");
  }

  if(REGISTRATION.AUTO_ACTIVATE_NEW_USERS) {
    await deanonymizeUser(user)

    req.logger.verbose(`User ${userId} deanonymized their account with email ${newEmail}`, {
      userId,
      newEmail
    })
  } else {
    const ticket = uuid4() // will be decrypted on the auth/activate call
    const ticketExpiresAt = new Date(+new Date() + 60 * 60 * 1000) // active for 60 minutes

    await gqlSDK.updateUser({
      id: userId,
      user: {
        ticket,
        ticketExpiresAt,
        active: false,
      }
    })

    await emailClient.send({
      template: 'activate-account',
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
        display_name: user.displayName,
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
