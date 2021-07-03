import { Request, Response, NextFunction } from 'express'
import { getClaims, getPermissionVariablesFromClaims } from '@/jwt'
import { gqlSdk } from '@/utils/gqlSDK'

export default async function (req: Request, res: Response, next: NextFunction) {
  let permissionVariables = null
  try {
    permissionVariables = getPermissionVariablesFromClaims(getClaims(req.headers.authorization))
  } catch (e) {
    // noop
  }

  console.log({ permissionVariables })
  //

  const auth = permissionVariables
    ? {
        loggedIn: true,
        userId: permissionVariables['user-id'],
        defaultRole: permissionVariables['default-role']
      }
    : {
        loggedIn: false,
        userId: null,
        defaultRole: null
      }

  req.auth = auth

  if ('refreshToken' in req.query) {
    req.refreshToken = req.query.refreshToken as string
    delete req.query.refreshToken

    const user = await gqlSdk
      .usersByRefreshToken({
        refreshToken: req.refreshToken
      })
      .then((res) => res.authRefreshTokens[0]?.user)

    if (!user) {
      return res.boom.unauthorized('Invalid or expired refresh token')
    }
  }

  req.logger.debug(
    `Request from user ${req.auth.userId}(${req.auth.defaultRole}) with refresh token ${req.refreshToken}`,
    {
      userId: req.auth.userId,
      defaultRole: req.auth.defaultRole,
      refreshToken: req.refreshToken
    }
  )

  next()
}
