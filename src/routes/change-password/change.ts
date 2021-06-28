import { Response, Router } from 'express'
import bcrypt from 'bcryptjs'

import { asyncWrapper, checkHibp, getUser, hashPassword } from '@/helpers'
import { ChangePasswordFromOldSchema, changePasswordFromOldSchema } from '@/validation'
import {
  ValidatedRequestSchema,
  ContainerTypes,
  createValidator,
  ValidatedRequest
} from 'express-joi-validation'
import { gqlSDK } from '@/utils/gqlSDK'

/**
 * Change the password from the current one
 */
async function basicPasswordChange(req: ValidatedRequest<Schema>, res: Response): Promise<unknown> {
  if (!req.permission_variables) {
    return res.boom.unauthorized('Not logged in')
  }

  const { 'user-id': userId } = req.permission_variables

  const { oldPassword, newPassword } = req.body

  // TODO: rewrite to something like
  // await checkHibp(newPassword).catch(err => {
  //   return res.boom??
  // })
  try {
    await checkHibp(newPassword)
  } catch (err) {
    return res.boom.badRequest(err.message)
  }

  const user = await getUser(userId)

  // Check the old (current) password
  if (user.passwordHash) {
    const isSamePassword = await bcrypt.compare(oldPassword, user.passwordHash)
    if (!isSamePassword) {
      return res.boom.unauthorized('Incorrect current password.')
    }
  }
  //else {
  // user does not have a current password so we'll allow the user to
  // change to whatever password
  //}

  const newPasswordHash = await hashPassword(newPassword)

  await gqlSDK.updateUser({
    id: userId,
    user: {
      passwordHash: newPasswordHash
    }
  })

  req.logger.verbose(`User ${userId} directly changed password to ${newPasswordHash} (hashed)`, {
    userId,
    newPasswordHash
  })

  return res.status(204).send()
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: ChangePasswordFromOldSchema
}

export default (router: Router) => {
  router.post(
    '/',
    createValidator().body(changePasswordFromOldSchema),
    asyncWrapper(basicPasswordChange)
  )
}
