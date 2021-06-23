import { Request, Response, Router } from 'express'
import { authenticator } from 'otplib'
import { asyncWrapper, createQR, selectAccountByUserId } from '@/helpers'
import { MFA } from '@config/index'
import { request } from '@/request'
import { updateOtpSecret } from '@/queries'
import { AccountData } from '@/types'

async function generateMfa(req: Request, res: Response): Promise<unknown> {
  if (!req.permission_variables) {
    return res.boom.unauthorized('Not logged in')
  }

  const { 'user-id': user_id } = req.permission_variables

  let mfa_enabled: AccountData['mfa_enabled']
  try {
    const account = await selectAccountByUserId(user_id)
    mfa_enabled = account.mfa_enabled
  } catch (err) {
    return res.boom.badRequest(err.message)
  }

  if (mfa_enabled) {
    return res.boom.badRequest('MFA is already enabled.')
  }

  /**
   * Generate OTP secret and key URI.
   */
  const otp_secret = authenticator.generateSecret()
  const otpAuth = authenticator.keyuri(user_id, MFA.OTP_ISSUER, otp_secret)

  await request(updateOtpSecret, { user_id, otp_secret })

  let image_url: string
  try {
    image_url = await createQR(otpAuth)
  } catch (err) {
    return res.boom.internal(err.message)
  }

  req.logger.verbose(`User ${user_id} generated an OTP sercret to enable MFA`, {
    user_id,
  })

  return res.send({ image_url, otp_secret })
}

export default (router: Router) => {
  router.post('/generate', asyncWrapper(generateMfa))
}
