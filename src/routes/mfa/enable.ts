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
import { gqlSDK } from '@/utils/gqlSDK'

async function enableMfa(req: ValidatedRequest<Schema>, res: Response): Promise<unknown> {
  if (!req.permission_variables) {
    return res.boom.unauthorized('Not logged in')
  }

  const { 'user-id': userId } = req.permission_variables
  const { code } = req.body

  const user = await getUser(userId)

  if (user.MFAEnabled) {
    return res.boom.badRequest('MFA is already enabled.')
  }

  if (!user.OTPSecret) {
    return res.boom.badRequest('OTP secret is not set.')
  }

  if (!authenticator.check(code, user.OTPSecret)) {
    return res.boom.unauthorized('Invalid two-factor code.')
  }

  await gqlSDK.updateUser({
    id: user.id,
    user: {
      MFAEnabled: true
    }
  })

  req.logger.verbose(`User ${userId} enabled MFA`, {
    userId
  })

  return res.status(204).send()
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: MfaSchema
}

export default (router: Router) => {
  router.post('/enable', createValidator().body(mfaSchema), asyncWrapper(enableMfa))
}
