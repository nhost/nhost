import { Response, Router } from 'express'
import { v4 as uuidv4 } from 'uuid'

import { asyncWrapper, isCompromisedPassword, hashPassword, selectAccountByTicket } from '@/helpers'
import { ResetPasswordWithTicketSchema, resetPasswordWithTicketSchema } from '@/validation'
import { updatePasswordWithTicket } from '@/queries'
import { request } from '@/request'
import { UpdateAccountData } from '@/types'
import { AUTHENTICATION } from '@config/index'
import { ValidatedRequestSchema, ContainerTypes, createValidator, ValidatedRequest } from 'express-joi-validation'

/**
 * Reset the password, either from a valid ticket or from a valid JWT and a valid password
 */
async function resetPassword(req: ValidatedRequest<Schema>, res: Response): Promise<unknown> {
  if(!AUTHENTICATION.LOST_PASSWORD_ENABLED) {
    return res.boom.notImplemented(`Please set the LOST_PASSWORD_ENABLE env variable to true to use the auth/change-password/change route`)
  }

  // Reset the password from { ticket, new_password }
  const { ticket, new_password } = req.body

  if(await isCompromisedPassword(new_password)) {
    req.logger.verbose(`User with ticket ${ticket} tried changing his password but it was too weak`, {
      ticket,
    })
    return res.boom.badRequest('Password is too weak')
  }

  const password_hash = await hashPassword(new_password)

  const new_ticket = uuidv4();

  const hasuraData = await request<UpdateAccountData>(updatePasswordWithTicket, {
    ticket,
    password_hash,
    now: new Date(),
    new_ticket
  })

  const { affected_rows, returning } = hasuraData.update_auth_accounts
  if (!affected_rows) {
    return res.boom.unauthorized('Invalid or expired ticket')
  }

  const user_id = returning[0].user_id

  req.logger.verbose(`User ${user_id} reset his password to ${password_hash}`, {
    user_id,
    password_hash
  })

  return res.status(204).send()
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: ResetPasswordWithTicketSchema
}

export default (router: Router) => {
  router.post('/change', createValidator().body(resetPasswordWithTicketSchema), asyncWrapper(resetPassword))
}
