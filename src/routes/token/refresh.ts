import { Response, Router, Request } from 'express'
import { newJwtExpiry, createHasuraJwtToken } from '@/jwt'
import { v4 as uuidv4 } from 'uuid'
import { SessionUser, Session } from '@/types'
import { asyncWrapper, newRefreshExpiry, userToSessionUser } from '@/helpers'
import { gqlSdk } from '@/utils/gqlSDK'

async function refreshToken({ refreshToken }: Request, res: Response): Promise<any> {
  if (!refreshToken) {
    return res.boom.unauthorized('Invalid or expired refresh token')
  }

  const user = await gqlSdk
    .usersByRefreshToken({
      refreshToken
    })
    .then((res) => res.authRefreshTokens[0]?.user!)

  // create a new refresh token
  const newRefreshToken = uuidv4()

  // delete old refresh token
  // and insert new refresh token
  await gqlSdk.updateRefreshToken({
    refreshTokenId: refreshToken,
    refreshToken: {
      userId: user.id,
      refreshToken: newRefreshToken,
      expiresAt: new Date(newRefreshExpiry())
    }
  })

  const jwtToken = createHasuraJwtToken(user)
  const jwtExpiresIn = newJwtExpiry
  const sessionUser: SessionUser = userToSessionUser(user)
  const session: Session = {
    jwtToken,
    jwtExpiresIn,
    user: sessionUser,
    refreshToken: newRefreshToken
  }
  res.send(session)
}

export default (router: Router) => {
  router.get('/refresh', asyncWrapper(refreshToken))
}
