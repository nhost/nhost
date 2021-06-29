import { Response, Router } from 'express'
import { asyncWrapper } from '@/helpers'
import { request } from '@/request'
import {
  selectRefreshToken,
  deleteAllAccountRefreshTokens,
  deleteRefreshToken
} from '@/queries'
import { LogoutSchema, logoutSchema } from '@/validation'
import { AccountData } from '@/types'
import { ValidatedRequestSchema, ContainerTypes, createValidator, ValidatedRequest } from 'express-joi-validation'
interface HasuraData {
  auth_refresh_tokens: { account: AccountData }[]
}

async function logout({ body, refresh_token }: ValidatedRequest<Schema>, res: Response): Promise<unknown> {
  if (!refresh_token) {
    return res.boom.unauthorized('Invalid or expired refresh token')
  }

  // should we delete all refresh tokens to this user or not
  const { all } = body

  if (all) {
    // get user based on refresh token
    let hasura_data: HasuraData | null = null

    hasura_data = await request<HasuraData>(selectRefreshToken, {
      refresh_token,
      current_timestamp: new Date()
    })

    const account = hasura_data?.auth_refresh_tokens?.[0]?.account

    // delete all refresh tokens for user
    await request(deleteAllAccountRefreshTokens, {
      user_id: account.user.id
    })
  } else {
    // if only to delete single refresh token
    await request(deleteRefreshToken, {
      refresh_token
    })
  }

  return res.status(204).send()
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: LogoutSchema
} 

export default (router: Router) => {
  router.post('/logout', createValidator().body(logoutSchema), asyncWrapper(logout))
}
