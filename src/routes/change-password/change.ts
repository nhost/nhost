import { Response, Router } from 'express'
import bcrypt from 'bcryptjs'

import { asyncWrapper, checkHibp, hashPassword, selectAccountByUserId } from '@/helpers'
import { ChangePasswordFromOldSchema, changePasswordFromOldSchema } from '@/validation'
import { updatePasswordWithUserId } from '@/queries'
import { request } from '@/request'
import { AccountData } from '@/types'
import { ValidatedRequestSchema, ContainerTypes, createValidator, ValidatedRequest } from 'express-joi-validation'

/**
 * Change the password from the current one
 */
async function basicPasswordChange(req: ValidatedRequest<Schema>, res: Response): Promise<unknown> {
  if (!req.permission_variables) {
    return res.boom.unauthorized('Not logged in')
  }

  const { 'user-id': user_id } = req.permission_variables

  const { old_password, new_password } = req.body

  try {
    await checkHibp(new_password)
  } catch (err) {
    return res.boom.badRequest(err.message)
  }

  // Search the account from the JWT's account id
  let password_hash: AccountData['password_hash']
  try {
    const account = await selectAccountByUserId(user_id)
    password_hash = account.password_hash
  } catch (err) {
    return res.boom.badRequest(err.message)
  }

  // Check the old (current) password
  if (!(await bcrypt.compare(old_password, password_hash))) {
    return res.boom.unauthorized('Incorrect current password.')
  }

  let newPasswordHash: string
  try {
    newPasswordHash = await hashPassword(new_password)
  } catch (err) {
    return res.boom.internal(err.message)
  }

  await request(updatePasswordWithUserId, {
    user_id,
    password_hash: newPasswordHash
  })

  req.logger.verbose(`User ${user_id} directly changed his password to ${password_hash}`, {
    user_id,
    password_hash
  })

  return res.status(204).send()
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: ChangePasswordFromOldSchema
}

export default (router: Router) => {
  router.post('/', createValidator().body(changePasswordFromOldSchema), asyncWrapper(basicPasswordChange))
}

