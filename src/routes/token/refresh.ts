import { Response, Router, Request } from 'express'
import { selectRefreshToken, updateRefreshToken } from '@/queries'

import { newJwtExpiry, createHasuraJwtToken } from '@/jwt'
import { request } from '@/request'
import { v4 as uuidv4 } from 'uuid'
import { SessionUser, Session } from '@/types'
import { asyncWrapper, newRefreshExpiry } from '@/helpers'
import { UserFieldsFragment } from '@/utils/__generated__/graphql-request'

interface HasuraData {
  auth_refresh_tokens: { account: UserFieldsFragment }[]
}

async function refreshToken({ refresh_token }: Request, res: Response): Promise<any> {
  if (!refresh_token) {
    return res.boom.unauthorized('Invalid or expired refresh token')
  }

  // get account based on refresh token
  const { auth_refresh_tokens } = await request<HasuraData>(selectRefreshToken, {
    refresh_token,
    current_timestamp: new Date()
  })

  // create a new refresh token
  const new_refresh_token = uuidv4()
  const { account } = auth_refresh_tokens[0]

  // delete old refresh token
  // and insert new refresh token
  await request(updateRefreshToken, {
    old_refresh_token: refresh_token,
    new_refresh_token_data: {
      account_id: account.id,
      refresh_token: new_refresh_token,
      expires_at: new Date(newRefreshExpiry())
    }
  })

  const jwtToken = createHasuraJwtToken(account)
  const jwtExpiresIn = newJwtExpiry
  const sessionUser: SessionUser = {
    id: account.id,
    displayName: account.displayName,
    email: account.email,
    avatarUrl: account.avatarUrl
  }
  const session: Session = { jwtToken, jwtExpiresIn, user: sessionUser, refreshToken: new_refresh_token }
  res.send(session)
}

export default (router: Router) => {
  router.get('/refresh', asyncWrapper(refreshToken))
}
