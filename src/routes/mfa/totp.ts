import { Response, Router } from 'express'
import { asyncWrapper, rotateTicket, getUserByTicket, setRefreshToken, userToSessionUser } from '@/helpers'
import { newJwtExpiry, createHasuraJwtToken } from '@/jwt'
import { Session, SessionUser } from '@/types'

import { authenticator } from 'otplib'
import { TotpSchema, totpSchema } from '@/validation'
import { ValidatedRequestSchema, ContainerTypes, createValidator, ValidatedRequest } from 'express-joi-validation'

// Increase the authenticator window so that TOTP codes from the previous 30 seconds are also valid
authenticator.options = {
  window: [1, 0]
}

async function totpLogin(req: ValidatedRequest<Schema>, res: Response): Promise<any> {
  const { ticket, code } = req.body

  const user = await getUserByTicket(req.body.ticket)

  if (!user) {
    return res.boom.unauthorized('Invalid or expired ticket')
  }

  const { id, otpSecret, mfaEnabled, active } = user

  const userId = user.id

  if (!mfaEnabled) {
    req.logger.verbose(`User ${userId} tried using totp but MFA was not enabled`, {
      userId
    })
    return res.boom.badRequest('MFA is not enabled')
  }

  if (!active) {
    req.logger.verbose(`User ${userId} tried using totp but his user is not activated`, {
       userId
    })
    return res.boom.badRequest('Account is not activated')
  }

  if (!otpSecret) {
    req.logger.verbose(`User ${userId} tried using totp but the OTP secret was not set`, {
      userId
    })
    return res.boom.badRequest('OTP secret is not set')
  }

  if (!authenticator.check(code, otpSecret)) {
    req.logger.verbose(`User ${userId} tried using totp but provided an invalid code`, {
      userId
    })
    return res.boom.unauthorized('Invalid two-factor code')
  }

  const refreshToken = await setRefreshToken(id)
  await rotateTicket(ticket)
  const jwtToken = createHasuraJwtToken(user)
  const jwtExpiresIn = newJwtExpiry
  const sessionUser: SessionUser = userToSessionUser(user)

  const session: Session = { jwtToken, jwtExpiresIn, user: sessionUser, refreshToken }

  req.logger.verbose(`User ${user.id} logged in via a TOTP code`, {
    userId: user.id,
  })

  res.send(session)
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: TotpSchema
}

export default (router: Router) => {
  router.post('/totp', createValidator().body(totpSchema), asyncWrapper(totpLogin))
}
