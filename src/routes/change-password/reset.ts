import { Response, Router } from 'express'
import { v4 as uuidv4 } from 'uuid'

import { asyncWrapper, isCompromisedPassword, getUserByTicket, hashPassword } from '@/helpers'
import { ResetPasswordWithTicketSchema, resetPasswordWithTicketSchema } from '@/validation'
import { AUTHENTICATION } from '@config/index'
import {
  ValidatedRequestSchema,
  ContainerTypes,
  createValidator,
  ValidatedRequest
} from 'express-joi-validation'
import { gqlSdk } from '@/utils/gqlSDK'

/**
 * Reset the password, either from a valid ticket or from a valid JWT and a valid password
 */
async function resetPassword(req: ValidatedRequest<Schema>, res: Response): Promise<unknown> {
  if(!AUTHENTICATION.LOST_PASSWORD_ENABLED) {
    return res.boom.notImplemented(`Please set the LOST_PASSWORD_ENABLE env variable to true to use the auth/change-password/change route`)
  }

  // Reset the password from { ticket, newPassword }
  const { ticket, newPassword } = req.body

  const user = await getUserByTicket(ticket)

  if(!user) {
    return res.boom.badRequest('Invalid or expired ticket')
  }

  if(await isCompromisedPassword(newPassword)) {
    req.logger.verbose(`User with ticket ${ticket} tried changing his password but it was too weak`, {
      ticket,
    })
    return res.boom.badRequest('Password is too weak')
  }

  const passwordHash = await hashPassword(newPassword)

  await gqlSdk.updateUser({
    id: user.id,
    user: {
      ticket: uuidv4(),
      ticketExpiresAt: new Date(),
      passwordHash
    }
  })

  req.logger.verbose(`User ${user.id} reset password to ${passwordHash}`, {
    userId: user.id,
    passwordHash
  })

  return res.status(204).send()
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: ResetPasswordWithTicketSchema
}

export default (router: Router) => {
  router.post(
    '/change',
    createValidator().body(resetPasswordWithTicketSchema),
    asyncWrapper(resetPassword)
  )
}
