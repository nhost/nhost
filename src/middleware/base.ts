import { Request, Response, NextFunction } from 'express'
import { getClaims, getPermissionVariablesFromClaims } from '@/jwt'
import logger from '@/logger'

export default function (req: Request, res: Response, next: NextFunction) {
  try {
    req.permission_variables = getPermissionVariablesFromClaims(
      getClaims(req.headers.authorization)
    )
  } catch (e) {
    // noop
  }

  if ('refresh_token' in req.query) {
    req.refresh_token = req.query.refresh_token as string
    delete req.query.refresh_token
  }

  logger.debug(`Request from user ${req.permission_variables?.['user-id']}(${req.permission_variables?.['default-role']}) with refresh token ${req.refresh_token}`, {
    user_id: req.permission_variables?.['user-id'],
    default_role: req.permission_variables?.['default-role'],
    refresh_token: req.refresh_token
  })

  next()
}
