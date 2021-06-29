import { asyncWrapper, selectAccountByUserId } from '@/helpers'
import { Response, Router } from 'express'
import { deleteOtpSecret } from '@/queries'

import { authenticator } from 'otplib'
import { MfaSchema, mfaSchema } from '@/validation'
import { request } from '@/request'
import { AccountData } from '@/types'
import { ValidatedRequestSchema, ContainerTypes, createValidator, ValidatedRequest } from 'express-joi-validation'

async function disableMfa(req: ValidatedRequest<Schema>, res: Response): Promise<unknown> {
  if (!req.permission_variables) {
    return res.boom.unauthorized('Not logged in')
  }

  const { 'user-id': user_id } = req.permission_variables

  const { code } = req.body

  const account = await selectAccountByUserId(user_id)

  const { otp_secret, mfa_enabled } = account

  if (!mfa_enabled) {
    req.logger.verbose(`User ${user_id} tried disabling MFA but it was already disabled`, {
      user_id
    })
    return res.boom.badRequest('MFA is already disabled')
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  if (!authenticator.check(code, otp_secret!)) {
    req.logger.verbose(`User ${user_id} tried disabling MFA but provided an invalid two-factor code ${code}`, {
      user_id,
      code
    })
    return res.boom.unauthorized('Invalid two-factor code')
  }

  await request(deleteOtpSecret, { user_id })

  req.logger.verbose(`User ${user_id} disabled MFA`, {
    user_id,
  })

  return res.status(204).send()
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: MfaSchema
}

export default (router: Router) => {
  router.post('/disable', createValidator().body(mfaSchema), asyncWrapper(disableMfa))
}
