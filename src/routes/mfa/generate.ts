import { Request, Response, Router } from 'express'
import { authenticator } from 'otplib'
import { asyncWrapper, createQR, getUser } from '@/helpers'
import { MFA } from '@config/index'
import { request } from '@/request'
import { updateOtpSecret } from '@/queries'

async function generateMfa(req: Request, res: Response): Promise<unknown> {
  if (!req.permission_variables) {
    return res.boom.unauthorized('Not logged in')
  }

  const { 'user-id': userId } = req.permission_variables

  const user = await getUser(userId)

  const { mfaEnabled } = user

  if (mfaEnabled) {
    req.logger.verbose(`User ${userId} tried generating MFA but it was already enabled`, {
      userId
    })
    return res.boom.badRequest('MFA is already enabled')
  }

  /**
   * Generate OTP secret and key URI.
   */
  const otp_secret = authenticator.generateSecret()
  const otpAuth = authenticator.keyuri(userId, MFA.OTP_ISSUER, otp_secret)

  await request(updateOtpSecret, { userId, otp_secret })

  const image_url = await createQR(otpAuth)

  req.logger.verbose(`User ${userId} generated an OTP sercret to enable MFA`, {
    userId,
  })

  return res.send({ image_url, otp_secret })
}

export default (router: Router) => {
  router.post('/generate', asyncWrapper(generateMfa))
}
