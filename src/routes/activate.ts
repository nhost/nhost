import { APPLICATION, REGISTRATION } from '@config/index'
import { Response, Router } from 'express'

import { asyncWrapper, deanonymizeUser, getUserByTicket } from '@/helpers'
import { v4 as uuidv4 } from 'uuid'
import { VerifySchema, verifySchema } from '@/validation'
import { UpdateAccountData } from '@/types'
import { ValidatedRequestSchema, ContainerTypes, createValidator, ValidatedRequest } from 'express-joi-validation'
import { gqlSDK } from '@/utils/gqlSDK'

async function activateUser(req: ValidatedRequest<Schema>, res: Response): Promise<unknown> {
  if (REGISTRATION.AUTO_ACTIVATE_NEW_USERS) {
    return res.boom.notImplemented(`Please set the AUTO_ACTIVATE_NEW_USERS env variable to false to use the auth/activate route`)
  }

  const { ticket } = req.query

  const user = await getUserByTicket(ticket)

  if(!user) {
    return res.boom.unauthorized('Invalid or expired ticket')
  }

  const newTicket = uuidv4()
  const newTicketExpiresAt = new Date()

  if (user.isAnonymous) {
    await deanonymizeUser(user)

    await gqlSDK.rotateUserTicket({
      oldTicket: ticket,
      newTicket,
      newTicketExpiresAt
    })

    req.logger.verbose(`User ${user.id} deanonymized with email ${user.email}`, {
      userId: user.id,
      email: user.email
    })
  } else {
    await gqlSDK.activateUser({
      ticket,
      newTicket,
      newTicketExpiresAt
    })

    req.logger.verbose(`User ${user.id} activated`, {
      userId: user.id
    })

    // redirect user to app
    const refreshToken = uuidv4() // setRefreshToken({userId: user.id});
    res.redirect(`${APPLICATION.REDIRECT_URL_SUCCESS}?refreshToken=${refreshToken}`)
  }
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Query]: VerifySchema
}

export default (router: Router) => {
  router.get('/activate', createValidator().query(verifySchema), asyncWrapper(activateUser))
}
