import { AUTHENTICATION, APPLICATION, REGISTRATION, HEADERS } from '@config/index'
import { NextFunction, Response, Router } from 'express'
import { asyncWrapper, checkHibp, hashPassword, selectAccount, setRefreshToken, getGravatarUrl, isAllowedEmail } from 'src/helpers'
import { newJwtExpiry, createHasuraJwt } from 'src/jwt'
import { emailClient } from 'src/email'
import { insertAccount } from 'src/queries'
import { isMagicLinkLogin, isMagicLinkRegister, isRegularLogin, RegisterSchema, registerSchema } from 'src/validation'
import { request } from 'src/request'
import { v4 as uuidv4 } from 'uuid'
import { InsertAccountData, UserData, Session } from 'src/types'
import { ValidatedRequest, ValidatedRequestSchema, ContainerTypes, createValidator } from 'express-joi-validation'

async function registerAccount(req: ValidatedRequest<Schema>, res: Response): Promise<unknown> {
  const body = req.body

  if (REGISTRATION.ADMIN_ONLY) {
    const adminSecret = req.headers[HEADERS.ADMIN_SECRET_HEADER]

    if (adminSecret !== APPLICATION.HASURA_GRAPHQL_ADMIN_SECRET) {
      return res.boom.unauthorized('Invalid x-admin-secret')
    }
  }

  const {
    email,
    user_data = {},
    register_options = {},
    locale
  } = body

  if (REGISTRATION.WHITELIST && !(await isAllowedEmail(email))) {
    return res.boom.unauthorized('Email not allowed')
  }

  if (await selectAccount(body)) {
    return res.boom.badRequest('Account already exists.')
  }

  let password_hash: string | null = null

  const ticket = uuidv4()
  const ticket_expires_at = new Date(+new Date() + 60 * 60 * 1000).toISOString() // active for 60 minutes

  if (isRegularLogin(body)) {
    try {
      await checkHibp(body.password)
    } catch (err) {
      return res.boom.badRequest(err.message)
    }

    try {
      password_hash = await hashPassword(body.password)
    } catch (err) {
      return res.boom.internal(err.message)
    }
  }

  const defaultRole = register_options.default_role ?? REGISTRATION.DEFAULT_USER_ROLE
  const allowedRoles = register_options.allowed_roles ?? REGISTRATION.DEFAULT_ALLOWED_USER_ROLES

  // check if default role is part of allowedRoles
  if (!allowedRoles.includes(defaultRole)) {
    return res.boom.badRequest('Default role must be part of allowed roles.')
  }

  // check if allowed roles is a subset of ALLOWED_ROLES
  if (!allowedRoles.every((role: string) => REGISTRATION.ALLOWED_USER_ROLES.includes(role))) {
    return res.boom.badRequest('allowed roles must be a subset of ALLOWED_ROLES')
  }

  const accountRoles = allowedRoles.map((role: string) => ({ role }))

  const avatarUrl = getGravatarUrl(email)

  let accounts: InsertAccountData
  try {
    accounts = await request<InsertAccountData>(insertAccount, {
      account: {
        email,
        password_hash,
        ticket,
        ticket_expires_at,
        active: REGISTRATION.AUTO_ACTIVATE_NEW_USERS,
        locale,
        default_role: defaultRole,
        account_roles: {
          data: accountRoles
        },
        user: {
          data: {
            display_name: email,
            avatar_url: avatarUrl,
            ...user_data
          }
        }
      }
    })
  } catch (e) {
    console.error('Error inserting user account')
    console.error(e)
    return res.boom.badRequest('Error inserting user account ' + JSON.stringify(e, null, 2))
  }

  const account = accounts.insert_auth_accounts.returning[0]
  const user: UserData = {
    id: account.user.id,
    display_name: account.user.display_name,
    email: account.email,
    avatar_url: account.user.avatar_url
  }

  if (!REGISTRATION.AUTO_ACTIVATE_NEW_USERS && AUTHENTICATION.VERIFY_EMAILS) {
    if (!APPLICATION.EMAILS_ENABLED) {
      return res.boom.badImplementation('SMTP settings unavailable')
    }

    // use display name from `user_data` if available
    const display_name = 'display_name' in user_data ? user_data.display_name : email

    if (isMagicLinkLogin(body)) {
      try {
        await emailClient.send({
          template: 'magic-link',
          message: {
            to: user.email,
            headers: {
              'x-ticket': {
                prepared: true,
                value: ticket
              }
            }
          },
          locals: {
            display_name,
            token: ticket,
            url: APPLICATION.SERVER_URL,
            locale: account.locale,
            app_url: APPLICATION.APP_URL,
            action: 'register',
            action_url: 'register'
          }
        })
      } catch (err) {
        console.error(err)
        return res.boom.badRequest('dfdsf' + JSON.stringify(err, null, 2))
      }

      const session: Session = { jwt_token: null, jwt_expires_in: null, user }
      return res.send(session)
    }

    try {
      await emailClient.send({
        template: 'activate-account',
        message: {
          to: email,
          headers: {
            'x-ticket': {
              prepared: true,
              value: ticket
            }
          }
        },
        locals: {
          display_name,
          ticket,
          url: APPLICATION.SERVER_URL,
          locale: account.locale
        }
      })
    } catch (err) {
      console.error('eml', err)
      return res.boom.badRequest('eewe' + JSON.stringify(err, null, 2))
    }

    const session: Session = { jwt_token: null, jwt_expires_in: null, user }
    return res.send(session)
  }

  const refresh_token = await setRefreshToken(account.id)

  // generate JWT
  const jwt_token = createHasuraJwt(account)
  const jwt_expires_in = newJwtExpiry

  const session: Session = { jwt_token, jwt_expires_in, user, refresh_token }

  return res.send(session)
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: RegisterSchema
}

export default (router: Router) => {
  router.post(
    '/register',
    createValidator().body(registerSchema),
    (req: ValidatedRequest<Schema>, res: Response, next: NextFunction) => {
      if(isMagicLinkRegister(req.body) && !AUTHENTICATION.MAGIC_LINK_ENABLED) {
        return res.boom.badRequest('Magic link registration is disabled')
      } else {
        return next()
      }
    },
    asyncWrapper(registerAccount)
  )
}
