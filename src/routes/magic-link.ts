import { APPLICATION } from '@config/index'
import { Response, Router } from 'express'

import { asyncWrapper, newRefreshExpiry } from '@/helpers'
import { v4 as uuidv4 } from 'uuid'
import { MagicLinkQuery, magicLinkQuery } from '@/validation'
import { setRefreshToken } from '@/helpers'
import { ValidatedRequestSchema, ContainerTypes, createValidator, ValidatedRequest } from 'express-joi-validation'
import { gqlSdk } from '@/utils/gqlSDK'

async function magicLink(req: ValidatedRequest<Schema>, res: Response): Promise<unknown> {
  const { token, action } = req.query;

  let refreshToken = token;
  if (action === 'register') {
    const newTicket = uuidv4()
    const user = await gqlSdk.activateUsers({
      ticket: token,
      newTicket,
      newTicketExpiresAt: newRefreshExpiry()
    }).then(res => res.updateUsers?.returning[0])

    if (!user) {
      if (APPLICATION.REDIRECT_URL_ERROR) {
        return res.redirect(302, APPLICATION.REDIRECT_URL_ERROR)
      }
      return res.boom.unauthorized('Invalid or expired token')
    }

    refreshToken = await setRefreshToken(user.id)
  }


  const user = await gqlSdk.usersByRefreshToken({
    refreshToken
  }).then(res => res.authRefreshTokens[0]?.user)

  if (!user) {
    if (APPLICATION.REDIRECT_URL_ERROR) {
      return res.redirect(302, APPLICATION.REDIRECT_URL_ERROR)
    }
    return res.boom.unauthorized('Invalid or expired token')
  }

  req.logger.verbose(`User ${user.id} completed magic link ${action === 'register' ? 'registration' : 'login'}`, {
    userId: user.id
  })

  // Redirect user with refresh token.
  // This is both for when users log in and register.
  return res.redirect(`${APPLICATION.REDIRECT_URL_SUCCESS}?refreshToken=${refreshToken}`)
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Query]: MagicLinkQuery
}

export default (router: Router) => {
  router.get('/magic-link', createValidator().query(magicLinkQuery), asyncWrapper(magicLink))
}
