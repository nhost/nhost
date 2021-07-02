import { asyncWrapper, getUser } from '@/helpers'
import { Response, Router } from 'express'

import { authenticator } from 'otplib'
import { MfaSchema, mfaSchema } from '@/validation'
import {
  ValidatedRequestSchema,
  ContainerTypes,
  createValidator,
  ValidatedRequest
} from 'express-joi-validation'
import { gqlSdk } from '@/utils/gqlSDK'

async function disableMfa(req: ValidatedRequest<Schema>, res: Response): Promise<unknown> {
  if (!req.permissionVariables) {
    return res.boom.unauthorized('Not logged in')
  }

  const { 'user-id': userId } = req.permissionVariables

  const { code } = req.body

  const user = await getUser(userId)

  const { otpSecret, mfaEnabled } = user

  if (!mfaEnabled) {
    req.logger.verbose(`User ${userId} tried disabling MFA but it was already disabled`, {
      userId
    })
    return res.boom.badRequest('MFA is already disabled')
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  if (!authenticator.check(code, otpSecret!)) {
    req.logger.verbose(`User ${userId} tried disabling MFA but provided an invalid two-factor code ${code}`, {
      userId,
      code
    })
    return res.boom.unauthorized('Invalid two-factor code')
  }

  await gqlSdk.updateUser({
    id: user.id,
    user: {
      otpSecret: null,
      mfaEnabled: false
    }
  })

  req.logger.verbose(`User ${userId} disabled MFA`, {
    userId
  })

  return res.status(204).send()
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: MfaSchema
}

export default (router: Router) => {
  router.post('/disable', createValidator().body(mfaSchema), asyncWrapper(disableMfa))
}
