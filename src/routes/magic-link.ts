import { APPLICATION } from '@config/index'
import { Response, Router } from 'express'
import { accountOfRefreshToken, activateAccount } from '@/queries'
import { asyncWrapper } from '@/helpers'
import { request } from '@/request'
import { v4 as uuidv4 } from 'uuid'
import { MagicLinkQuery, magicLinkQuery } from '@/validation'
import { UpdateAccountData } from '@/types'
import { setRefreshToken } from '@/helpers'
import { ValidatedRequestSchema, ContainerTypes, createValidator, ValidatedRequest } from 'express-joi-validation'
import { UserFieldsFragment } from '@/utils/__generated__/graphql-request'

async function magicLink(req: ValidatedRequest<Schema>, res: Response): Promise<unknown> {
  const { token, action } = req.query;

  let refresh_token = token;
  if (action === 'register') {
    const new_ticket = uuidv4()
    const { affected_rows, returning } = await request<UpdateAccountData>(activateAccount, {
      ticket: token,
      new_ticket,
      now: new Date()
    }).then(hasuraData => hasuraData.update_auth_accounts)

    if (!affected_rows) {
      if (APPLICATION.REDIRECT_URL_ERROR) {
        return res.redirect(302, APPLICATION.REDIRECT_URL_ERROR)
      }
      return res.boom.unauthorized('Invalid or expired token')
    }

    refresh_token = await setRefreshToken(returning[0].id)
  }

  const hasura_data = await request<{
    auth_refresh_tokens: { account: UserFieldsFragment }[]
  }>(accountOfRefreshToken, {
    refresh_token,
  })
  const account = hasura_data.auth_refresh_tokens?.[0].account;
  if (!account) {
    if (APPLICATION.REDIRECT_URL_ERROR) {
      return res.redirect(302, APPLICATION.REDIRECT_URL_ERROR)
    }
    return res.boom.unauthorized('Invalid or expired token')
  }

  req.logger.verbose(`User ${account.id} completed magic link ${action === 'register' ? 'registration' : 'login'}`, {
    user_id: account.id
  })

  // Redirect user with refresh token.
  // This is both for when users log in and register.
  return res.redirect(`${APPLICATION.REDIRECT_URL_SUCCESS}?refresh_token=${refresh_token}`)
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Query]: MagicLinkQuery
}

export default (router: Router) => {
  router.get('/magic-link', createValidator().query(magicLinkQuery), asyncWrapper(magicLink))
}
