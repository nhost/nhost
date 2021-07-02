import { Request, Response, NextFunction } from 'express'
import { getClaims, getPermissionVariablesFromClaims } from '@/jwt'
import { gqlSdk } from '@/utils/gqlSDK'

export default async function (req: Request, res: Response, next: NextFunction) {
  try {
    req.permissionVariables = getPermissionVariablesFromClaims(
      getClaims(req.headers.authorization)
    )
  } catch (e) {
    // noop
  }

  if ('refreshToken' in req.query) {
    req.refreshToken = req.query.refreshToken as string
    delete req.query.refreshToken

    const user = await gqlSdk.usersByRefreshToken({
      refreshToken: req.refreshToken
    }).then(res => res.authRefreshTokens[0]?.user)
  
    if (!user) {
      return res.boom.unauthorized('Invalid or expired refresh token')
    }
  }

  req.logger.debug(`Request from user ${req.permissionVariables?.['user-id']}(${req.permissionVariables?.['default-role']}) with refresh token ${req.refreshToken}`, {
    userId: req.permissionVariables?.['user-id'],
    defaultRole: req.permissionVariables?.['default-role'],
    refreshToken: req.refreshToken
  })

  next()
}
