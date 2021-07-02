import { Response, Router } from 'express'
import bcrypt from 'bcryptjs'

import { asyncWrapper, isCompromisedPassword, getUser, hashPassword } from '@/helpers'
import { ChangePasswordFromOldSchema, changePasswordFromOldSchema } from '@/validation'
import {
  ValidatedRequestSchema,
  ContainerTypes,
  createValidator,
  ValidatedRequest
} from 'express-joi-validation'
import { gqlSdk } from '@/utils/gqlSDK'

/**
 * Change the password from the current one
 */
async function basicPasswordChange(req: ValidatedRequest<Schema>, res: Response): Promise<unknown> {
  if (!req.permissionVariables) {
    return res.boom.unauthorized('Not logged in')
  }

  const { 'user-id': userId } = req.permissionVariables

  const { oldPassword, newPassword } = req.body

  if(await isCompromisedPassword(newPassword)) {
    req.logger.verbose(`User ${userId} tried changing his password but it was too weak`, {
      userId,
    })
    return res.boom.badRequest('Password is too weak')
  }

  const user = await getUser(userId)

  if (user.passwordHash && !await bcrypt.compare(oldPassword, user.passwordHash)) {
    return res.boom.unauthorized('Incorrect current password')
  }

  const newPasswordHash = await hashPassword(newPassword)

  await gqlSdk.updateUser({
    id: userId,
    user: {
      passwordHash: newPasswordHash
    }
  })

  req.logger.verbose(`User ${userId} directly changed password to ${newPasswordHash}`, {
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
