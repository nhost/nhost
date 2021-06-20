import { Response, Router } from 'express'
import { v4 as uuidv4 } from 'uuid'

import { asyncWrapper, checkHibp, hashPassword } from 'src/helpers'
import { ResetPasswordWithTicketSchema, resetPasswordWithTicketSchema } from 'src/validation'
import { updatePasswordWithTicket } from 'src/queries'
import { request } from 'src/request'
import { UpdateAccountData, RequestExtended } from 'src/types'
import { AUTHENTICATION } from '@config/index'
import { ValidatedRequestSchema, ContainerTypes, createValidator } from 'express-joi-validation'

/**
 * Reset the password, either from a valid ticket or from a valid JWT and a valid password
 */
async function resetPassword(req: RequestExtended<Schema>, res: Response): Promise<unknown> {
  if(!AUTHENTICATION.LOST_PASSWORD_ENABLED) {
    return res.boom.badImplementation(`Please set the LOST_PASSWORD_ENABLE env variable to true to use the auth/change-password/change route.`)
  }

  // Reset the password from { ticket, new_password }
  const { ticket, new_password } = req.body

  try {
    await checkHibp(new_password)
  } catch (err) {
    return res.boom.badRequest(err.message)
  }

  let password_hash: string
  try {
    password_hash = await hashPassword(new_password)
  } catch (err) {
    return res.boom.internal(err.message)
  }

  const hasuraData = await request<UpdateAccountData>(updatePasswordWithTicket, {
    ticket,
    password_hash,
    now: new Date(),
    new_ticket: uuidv4()
  })

  const { affected_rows } = hasuraData.update_auth_accounts
  if (!affected_rows) {
    return res.boom.unauthorized('Invalid or expired ticket.')
  }

  return res.status(204).send()
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: ResetPasswordWithTicketSchema
}

export default (router: Router) => {
  router.post('/change', createValidator().body(resetPasswordWithTicketSchema), asyncWrapper(resetPassword))
}
