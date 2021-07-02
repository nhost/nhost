import { NextFunction, Response, Router } from 'express'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { asyncWrapper, getUserByEmail, setRefreshToken, userToSessionUser } from '@/helpers'
import { newJwtExpiry, createHasuraJwtToken } from '@/jwt'
import { isAnonymousLogin, isMagicLinkLogin, LoginSchema, loginSchema } from '@/validation'
import { Session } from '@/types'
import { emailClient } from '@/email'
import { AUTHENTICATION, APPLICATION, REGISTRATION, HEADERS } from '@config/index'
import { ValidatedRequestSchema, ContainerTypes, createValidator, ValidatedRequest } from 'express-joi-validation'
import { gqlSdk } from '@/utils/gqlSDK'

async function loginAccount(req: ValidatedRequest<Schema>, res: Response) {
  const { body, headers } = req

  if (isAnonymousLogin(body)) {
    const { locale } = body

    const ticket = uuidv4()
    const user = await gqlSdk.insertUser({
      user: {
        email: null,
        passwordHash: null,
        ticket,
        active: true,
        isAnonymous: true,
        locale,
        defaultRole: REGISTRATION.DEFAULT_ANONYMOUS_ROLE,
        roles: {
          data: [{ role: REGISTRATION.DEFAULT_ANONYMOUS_ROLE }]
        },
        displayName: 'Anonymous user'
      }
    }).then(res => res.insertUser)

    if (!user) {
      throw new Error('Unable to create user and sign in user anonymously')
    }

    const refreshToken = await setRefreshToken(user.id)

    const jwtToken = createHasuraJwtToken(user)
    const jwtExpiresIn = newJwtExpiry

    const session: Session = { jwtToken, jwtExpiresIn, user: userToSessionUser(user), refreshToken }

    req.logger.verbose(`User ${user.id} logged in anonymously`, {
      userId: user.id
    })

    return res.send(session)
  }

  const user = await getUserByEmail(body.email)

  if (!user) {
    req.logger.verbose(`User tried logged in with email ${body.email} but no user with such email exists`, {
      email: body.email
    })
    if(isMagicLinkLogin(body)) {
      return res.boom.badRequest('Invalid email')
    } else {
      return res.boom.badRequest('Invalid email or password')
    }
  }

  const { id, mfaEnabled, passwordHash, active, email } = user

  if (!active) {
    req.logger.verbose(`User ${user.id} tried logging in with email ${email} but his user is inactive`, {
      userId: user.id,
      email
    })
    return res.boom.badRequest('User is not activated')
  }

  if (isMagicLinkLogin(body)) {
    const refreshToken = await setRefreshToken(id)

    await emailClient.send({
      template: 'magic-link',
      message: {
        to: email,
        headers: {
          'x-ticket': {
            prepared: true,
            value: refreshToken
          }
        }
      },
      locals: {
        displayName: user.displayName,
        token: refreshToken,
        url: APPLICATION.SERVER_URL,
        locale: user.locale,
        appUrl: APPLICATION.APP_URL,
        action: 'log in',
        actionUrl: 'log-in'
      }
    })

    req.logger.verbose(`User ${user.id} logged in with magic link to email ${email}`, {
      userId: user.id,
      email
    })

    return res.send({ magicLink: true });
  }

  const { password } = body

  // Handle User Impersonation Check
  const adminSecret = headers[HEADERS.ADMIN_SECRET_HEADER]
  const hasAdminSecret = Boolean(adminSecret)
  const isAdminSecretCorrect = adminSecret === APPLICATION.HASURA_GRAPHQL_ADMIN_SECRET
  let userImpersonationValid = false;

  if (AUTHENTICATION.USER_IMPERSONATION_ENABLED && hasAdminSecret && !isAdminSecretCorrect) {
    return res.boom.unauthorized('Invalid x-admin-secret')
  } else if (AUTHENTICATION.USER_IMPERSONATION_ENABLED && hasAdminSecret && isAdminSecretCorrect) {
    userImpersonationValid = true;
  }

  // Validate Password
  const isPasswordCorrect = passwordHash && await bcrypt.compare(password, passwordHash)
  if (!isPasswordCorrect && !userImpersonationValid) {
    return res.boom.unauthorized('Username and password do not match')
  }

  if (mfaEnabled) {
    const ticket = uuidv4()
    const ticketExpiresAt = new Date(+new Date() + 60 * 60 * 1000)

    // set new ticket
    await gqlSdk.updateUser({
      id: user.id,
      user: {
        ticket,
        ticketExpiresAt
      }
    })

    req.logger.verbose(`User ${user.id} logged in with MFA`, {
      userId: user.id
    })

    return res.send({ mfa: true, ticket })
  }

  const refreshToken = await setRefreshToken(id)

  const jwtToken = createHasuraJwtToken(user)
  const jwtExpiresIn = newJwtExpiry
  const session: Session = { jwtToken, jwtExpiresIn, user: userToSessionUser(user), refreshToken }

  req.logger.verbose(`User ${user.id} logged in with email ${email}`, {
    userId: user.id,
    email
  })

  res.send(session)
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