import { Request, Response, NextFunction } from 'express'
import { getClaims, getPermissionVariablesFromClaims } from '@/jwt'
import { selectRefreshToken } from '@/queries'
import { AccountData } from '@/types'
import { request } from '@/request'

interface HasuraData {
  auth_refresh_tokens: { account: AccountData }[]
}

export default async function (req: Request, res: Response, next: NextFunction) {
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

    const { auth_refresh_tokens } = await request<HasuraData>(selectRefreshToken, {
      refresh_token: req.refresh_token,
      current_timestamp: new Date()
    })
  
    if (!auth_refresh_tokens?.length) {
      return res.boom.unauthorized('Invalid or expired refresh token')
    }
  }

  req.logger.debug(`Request from user ${req.permission_variables?.['user-id']}(${req.permission_variables?.['default-role']}) with refresh token ${req.refresh_token}`, {
    user_id: req.permission_variables?.['user-id'],
    default_role: req.permission_variables?.['default-role'],
    refresh_token: req.refresh_token
  })

  next()
}
