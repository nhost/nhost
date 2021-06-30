import { AUTHENTICATION, APPLICATION, REGISTRATION, HEADERS } from '@config/index'
import { NextFunction, Response, Router } from 'express'
import { asyncWrapper, isCompromisedPassword, hashPassword, setRefreshToken, getGravatarUrl, isAllowedEmail, getUserByEmail } from '@/helpers'
import { newJwtExpiry, createHasuraJwtToken } from '@/jwt'
import { emailClient } from '@/email'
import {
  isMagicLinkLogin,
  isMagicLinkRegister,
  isRegularLogin,
  RegisterSchema,
  registerSchema
} from '@/validation'
import { v4 as uuidv4 } from 'uuid'
import { Session } from '@/types'
import {
  ValidatedRequest,
  ValidatedRequestSchema,
  ContainerTypes,
  createValidator
} from 'express-joi-validation'
import { gqlSDK } from '@/utils/gqlSDK'

async function registerAccount(req: ValidatedRequest<Schema>, res: Response): Promise<unknown> {
  const body = req.body

  if (REGISTRATION.ADMIN_ONLY) {
    const adminSecret = req.headers[HEADERS.ADMIN_SECRET_HEADER]

    if (adminSecret !== APPLICATION.HASURA_GRAPHQL_ADMIN_SECRET) {
      return res.boom.unauthorized('Invalid x-admin-secret')
    }
  }

  const { email, user_data = {}, register_options = {}, locale } = body

  if (REGISTRATION.WHITELIST && !(await isAllowedEmail(email))) {
    return res.boom.unauthorized('Email not allowed')
  }

  if (await getUserByEmail(body.email)) {
    return res.boom.badRequest('Account already exists.')
  }

  let passwordHash: string | null = null

  const ticket = uuidv4()
  // Ticket expires after 60 min
  const ticketExpiresAt = new Date(+new Date() + 60 * 60 * 1000).toISOString()

  if (isRegularLogin(body)) {
    if(await isCompromisedPassword(body.password)) {
      return res.boom.badRequest('Password is too weak')
    }

    passwordHash = await hashPassword(body.password)
  }

  const defaultRole = register_options.default_role ?? REGISTRATION.DEFAULT_USER_ROLE
  const allowedRoles = register_options.allowed_roles ?? REGISTRATION.DEFAULT_ALLOWED_USER_ROLES

  // check if default role is part of allowedRoles
  if (!allowedRoles.includes(defaultRole)) {
    req.logger.verbose(`User tried registering with email ${email} but used an invalid default role ${defaultRole}`, {
      email,
      default_role: defaultRole,
      allowed_roles: allowedRoles
    })
    return res.boom.badRequest('Default role must be part of allowed roles')
  }

  // check if allowed roles is a subset of ALLOWED_ROLES
  if (!allowedRoles.every((role: string) => REGISTRATION.ALLOWED_USER_ROLES.includes(role))) {
    req.logger.verbose(`User tried registering with email ${email} but used an invalid role`, {
      email,
      allowed_roles: allowedRoles,
      app_allowed_roles: REGISTRATION.ALLOWED_USER_ROLES
    })
    return res.boom.badRequest('Allowed roles must be a subset of ALLOWED_ROLES')
  }

  const accountRoles = allowedRoles.map((role: string) => ({ role }))

  const avatarUrl = getGravatarUrl(email)

  const { insertUser: user } = await gqlSDK.insertUser({
    user: {
      displayName: email,
      avatarUrl,
      email,
      passwordHash,
      ticket,
      ticketExpiresAt,
      active: REGISTRATION.AUTO_ACTIVATE_NEW_USERS,
      locale,
      defaultRole,
      roles: {
        data: accountRoles
      }
    }
  })

  if (!user) {
    throw new Error('Unable to insert new user')
  }

  // create session user
  const sessionUser = {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl
  }

  if (!REGISTRATION.AUTO_ACTIVATE_NEW_USERS && AUTHENTICATION.VERIFY_EMAILS) {
    if (!APPLICATION.EMAILS_ENABLED) {
      throw new Error('SMTP settings unavailable')
    }

    // use display name from `user_data` if available
    const display_name = 'display_name' in user_data ? user_data.display_name : email

    if (isMagicLinkLogin(body)) {
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
          locale: user.locale,
          app_url: APPLICATION.APP_URL,
          action: 'register',
          action_url: 'register'
        }
      })

      const session: Session = {
        jwtToken: null,
        jwtExpiresIn: null,
        user: sessionUser,
      }

      req.logger.verbose(`New magic link user registration with id ${user.id} and email ${email}`, {
        userId: user.id,
        email
      })

      return res.send(session)
    }

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
        locale: user.locale
      }
    })

    const session: Session = { jwtToken: null, jwtExpiresIn: null, user: sessionUser }

    req.logger.verbose(`New user registration with id ${user.id} and email ${email}`, {
      user_id: user.id,
      email
    })

    return res.send(session)
  }

  // continue here if auto activate users

  const refreshToken = await setRefreshToken(user.id)

  // generate JWT
  const jwtToken = createHasuraJwtToken(user)
  const jwtExpiresIn = newJwtExpiry

  const session: Session = {jwtToken, jwtExpiresIn, user: sessionUser, refreshToken}

  req.logger.verbose(`New user registration with id ${user.id} and email ${email}`, {
    user_id: user.id,
    email
  })

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
      if (isMagicLinkRegister(req.body) && !AUTHENTICATION.MAGIC_LINK_ENABLED) {
        return res.boom.badRequest('Magic link registration is disabled')
      } else {
        return next()
      }
    },
    asyncWrapper(registerAccount)
  )
}
