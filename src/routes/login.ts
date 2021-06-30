import { NextFunction, Response, Router } from 'express'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { asyncWrapper, setRefreshToken } from '@/helpers'
import { newJwtExpiry, createHasuraJwtToken } from '@/jwt'
import { isAnonymousLogin, isMagicLinkLogin, LoginSchema, loginSchema } from '@/validation'
import { insertAccount, setNewTicket } from '@/queries'
import { request } from '@/request'
import { Session } from '@/types'
import { emailClient } from '@/email'
import { AUTHENTICATION, APPLICATION, REGISTRATION, HEADERS } from '@config/index'
import { ValidatedRequestSchema, ContainerTypes, createValidator, ValidatedRequest } from 'express-joi-validation'

async function loginAccount(req: ValidatedRequest<Schema>, res: Response) {
  // const { body, headers } = req

  // if (isAnonymousLogin(body)) {
  //   const { locale } = body

  //   const ticket = uuidv4()
  //   const hasura_data = await request<HasuraData>(insertAccount, {
  //     account: {
  //       email: null,
  //       password_hash: null,
  //       ticket,
  //       active: true,
  //       is_anonymous: true,
  //       locale,
  //       default_role: REGISTRATION.DEFAULT_ANONYMOUS_ROLE,
  //       account_roles: {
  //         data: [{ role: REGISTRATION.DEFAULT_ANONYMOUS_ROLE }]
  //       },
  //       user: {
  //         data: { display_name: 'Anonymous user' }
  //       }
  //     }
  //   })

  //   if (!hasura_data.insert_auth_accounts.returning.length) {
  //     throw new Error('Unable to create user and sign in user anonymously')
  //   }

  //   const account = hasura_data.insert_auth_accounts.returning[0]

  //   const refresh_token = await setRefreshToken(account.id)

  //   const jwt_token = createHasuraJwtToken(account)
  //   const jwt_expires_in = newJwtExpiry

  //   const session: Session = { jwt_token, jwt_expires_in, user: account.user, refresh_token }

  //   req.logger.verbose(`User ${account.user.id} logged in anonymously`, {
  //     user_id: account.user.id
  //   })

  //   return res.send(session)
  // }

  // const account = await selectAccountByEmail(body.email)

  // if (!account) {
  //   req.logger.verbose(`User tried logged in with email ${body.email} but no account with such email exists`, {
  //     email: body.email
  //   })
  //   if(isMagicLinkLogin(body)) {
  //     return res.boom.badRequest('Invalid email')
  //   } else {
  //     return res.boom.badRequest('Invalid email or password')
  //   }
  // }

  // const { id, mfa_enabled, password_hash, active, email } = account

  // if (!active) {
  //   req.logger.verbose(`User ${account.user.id} tried logging in with email ${email} but his account is inactive`, {
  //     user_id: account.user.id,
  //     email
  //   })
  //   return res.boom.badRequest('Account is not activated')
  // }

  // if (isMagicLinkLogin(body)) {
  //   const refresh_token = await setRefreshToken(id)

  //   await emailClient.send({
  //     template: 'magic-link',
  //     message: {
  //       to: email,
  //       headers: {
  //         'x-ticket': {
  //           prepared: true,
  //           value: refresh_token
  //         }
  //       }
  //     },
  //     locals: {
  //       display_name: account.user.display_name,
  //       token: refresh_token,
  //       url: APPLICATION.SERVER_URL,
  //       locale: account.locale,
  //       app_url: APPLICATION.APP_URL,
  //       action: 'log in',
  //       action_url: 'log-in'
  //     }
  //   })

  //   req.logger.verbose(`User ${account.user.id} logged in with magic link to email ${email}`, {
  //     user_id: account.user.id,
  //     email
  //   })

  //   return res.send({ magicLink: true });
  // }

  // const { password } = body

  // // Handle User Impersonation Check
  // const adminSecret = headers[HEADERS.ADMIN_SECRET_HEADER]
  // const hasAdminSecret = Boolean(adminSecret)
  // const isAdminSecretCorrect = adminSecret === APPLICATION.HASURA_GRAPHQL_ADMIN_SECRET
  // let userImpersonationValid = false;

  // if (AUTHENTICATION.USER_IMPERSONATION_ENABLED && hasAdminSecret && !isAdminSecretCorrect) {
  //   return res.boom.unauthorized('Invalid x-admin-secret')
  // } else if (AUTHENTICATION.USER_IMPERSONATION_ENABLED && hasAdminSecret && isAdminSecretCorrect) {
  //   userImpersonationValid = true;
  // }

  // // Validate Password
  // const isPasswordCorrect = await bcrypt.compare(password, password_hash)
  // if (!isPasswordCorrect && !userImpersonationValid) {
  //   return res.boom.unauthorized('Username and password do not match')
  // }

  // if (mfa_enabled) {
  //   const ticket = uuidv4()
  //   const ticket_expires_at = new Date(+new Date() + 60 * 60 * 1000)

  //   // set new ticket
  //   await request(setNewTicket, {
  //     user_id: account.user.id,
  //     ticket,
  //     ticket_expires_at
  //   })

  //   req.logger.verbose(`User ${account.user.id} logged in with MFA`, {
  //     user_id: account.user.id
  //   })

  //   return res.send({ mfa: true, ticket })
  // }

  // // refresh_token
  // const refresh_token = await setRefreshToken(id)

  // // generate JWT
  // const jwt_token = createHasuraJwt(account)
  // const jwt_expires_in = newJwtExpiry
  // const user: UserFieldsFragment = {
  //   id: account.user.id,
  //   display_name: account.user.display_name,
  //   email: account.email,
  //   avatar_url: account.user.avatar_url
  // }
  // const session: Session = { jwt_token, jwt_expires_in, user, refresh_token }

  // req.logger.verbose(`User ${user.id} logged in with email ${email}`, {
  //   user_id: user.id,
  //   email
  // })

  // res.send(session)
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: LoginSchema
}

export default (router: Router) => {
  router.post(
    '/login',
    createValidator().body(loginSchema),
    (req: ValidatedRequest<Schema>, res: Response, next: NextFunction) => {
      if(isAnonymousLogin(req.body) && !AUTHENTICATION.ANONYMOUS_USERS_ENABLED) {
        return res.boom.badRequest('Anonymous login is disabled')
      } else if(isMagicLinkLogin(req.body) && !AUTHENTICATION.MAGIC_LINK_ENABLED) {
        return res.boom.badRequest('Magic link login is disabled')
      } else {
        return next()
      }
    },
    asyncWrapper(loginAccount)
  )
}