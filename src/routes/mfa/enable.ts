import { asyncWrapper, selectAccountByUserId } from '@/helpers'
import { Response, Router } from 'express'
import { updateOtpStatus } from '@/queries'

import { authenticator } from 'otplib'
import { MfaSchema, mfaSchema } from '@/validation'
import { request } from '@/request'
import { AccountData } from '@/types'
import { ValidatedRequestSchema, ContainerTypes, createValidator, ValidatedRequest } from 'express-joi-validation'

async function enableMfa(req: ValidatedRequest<Schema>, res: Response): Promise<unknown> {
  if (!req.permission_variables) {
    return res.boom.unauthorized('Not logged in')
  }

  const { 'user-id': user_id } = req.permission_variables
  const { code } = req.body

  let otp_secret: AccountData['otp_secret']
  let mfa_enabled: AccountData['mfa_enabled']
  try {
    const account = await selectAccountByUserId(user_id)
    otp_secret = account.otp_secret
    mfa_enabled = account.mfa_enabled
  } catch (err) {
    return res.boom.badRequest(err.message)
  }

  if (mfa_enabled) {
    return res.boom.badRequest('MFA is already enabled.')
  }

  if (!otp_secret) {
    return res.boom.badRequest('OTP secret is not set.')
  }

  if (!authenticator.check(code, otp_secret)) {
    return res.boom.unauthorized('Invalid two-factor code.')
  }

  await request(updateOtpStatus, { user_id, mfa_enabled: true })

  req.logger.verbose(`User ${user_id} enabled MFA`, {
    user_id,
  })

  return res.status(204).send()
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: MfaSchema
}

export default (router: Router) => {
  router.post('/enable', createValidator().body(mfaSchema), asyncWrapper(enableMfa))
}
