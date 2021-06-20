import { Response, Router } from 'express'
import { selectRefreshToken, updateRefreshToken } from 'src/queries'

import { newJwtExpiry, createHasuraJwt } from 'src/jwt'
import { request } from 'src/request'
import { v4 as uuidv4 } from 'uuid'
import { AccountData, UserData, Session, RequestExtended } from 'src/types'
import { asyncWrapper, newRefreshExpiry } from 'src/helpers'

interface HasuraData {
  auth_refresh_tokens: { account: AccountData }[]
}

async function refreshToken({ refresh_token }: RequestExtended, res: Response): Promise<any> {
  if (!refresh_token) {
    return res.boom.unauthorized('Invalid or expired refresh token.')
  }

  // get account based on refresh token
  const { auth_refresh_tokens } = await request<HasuraData>(selectRefreshToken, {
    refresh_token,
    current_timestamp: new Date()
  })

  if (!auth_refresh_tokens?.length) {
    return res.boom.unauthorized('Invalid or expired refresh token.')
  }

  // create a new refresh token
  const new_refresh_token = uuidv4()
  const { account } = auth_refresh_tokens[0]

  // delete old refresh token
  // and insert new refresh token
  try {
    await request(updateRefreshToken, {
      old_refresh_token: refresh_token,
      new_refresh_token_data: {
        account_id: account.id,
        refresh_token: new_refresh_token,
        expires_at: new Date(newRefreshExpiry())
      }
    })
  } catch (error) {
    return res.boom.badImplementation('Unable to set new refresh token')
  }

  const jwt_token = createHasuraJwt(account)
  const jwt_expires_in = newJwtExpiry
  const user: UserData = {
    id: account.user.id,
    display_name: account.user.display_name,
    email: account.email,
    avatar_url: account.user.avatar_url
  }
  const session: Session = { jwt_token, jwt_expires_in, user, refresh_token: new_refresh_token }
  res.send(session)
}

export default (router: Router) => {
  router.get('/refresh', asyncWrapper(refreshToken))
}
