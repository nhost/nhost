import { APPLICATION, JWT, REGISTRATION } from '@config/index'
import { NextFunction, Response, Request } from 'express'
import * as gravatar from 'gravatar'
import QRCode from 'qrcode'
import bcrypt from 'bcryptjs'
import { pwnedPassword } from 'hibp'
import { v4 as uuidv4 } from 'uuid'
import { gqlSDK } from './utils/gqlSDK'
import { UserFieldsFragment } from './utils/__generated__/graphql-request'

/**
 * Create QR code.
 * @param secret Required OTP secret.
 */
export async function createQR(secret: string): Promise<string> {
  try {
    return await QRCode.toDataURL(secret)
  } catch (err) {
    throw new Error('Could not create QR code')
  }
}

/**
 * This wrapper function sends any route errors to `next()`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function asyncWrapper(fn: any) {
  return function (req: Request, res: Response, next: NextFunction): void {
    fn(req, res, next).catch(next)
  }
}

export const getUserByEmail = async (email: string) => {
  const { users } = await gqlSDK.users({
    where: {
      email: {
        _eq: email
      }
    }
  })

  if (users.length !== 1) {
    throw new Error('User does not exist.')
  }

  return users[0]
}

export const getUserByTicket = async (ticket: string) => {
  const now = new Date()

  const { users } = await gqlSDK.users({
    where: {
      _and: [
        {
          ticket: {
            _eq: ticket
          }
        },
        {
          ticketExpiresAt: {
            _gt: now
          }
        }
      ]
    }
  })

  if (users.length !== 1) {
    throw new Error('User does not exist.')
  }

  return users[0]
}

// TODO await request returns undefined if no user found!
export const getUser = async (userId: string | undefined) => {
  if (!userId) {
    throw new Error('User does not exists')
  }

  const { user } = await gqlSDK.user({
    id: userId
  })

  if (!user) {
    throw new Error('User does not exists')
  }

  return user
}

/**
 * Password hashing function.
 * @param password Password to hash.
 */
export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, 10)
}

/**
 * Checks password against the HIBP API.
 * @param password Password to check.
 */
export const checkHibp = async (password: string): Promise<void> => {
  if (REGISTRATION.HIBP_ENABLED && (await pwnedPassword(password))) {
    throw new Error('Password is too weak.')
  }
}

export const rotateTicket = async (oldTicket: string): Promise<string> => {
  const newTicket = uuidv4()

  await gqlSDK.rotateUserTicket({
    oldTicket,
    newTicket,
    newTicketExpiresAt: new Date()
  })

  return newTicket
}

export function newRefreshExpiry(): number {
  const now = new Date()
  // 1 day = 1440 minutes
  const days = JWT.REFRESH_EXPIRES_IN / 1440

  return now.setDate(now.getDate() + days)
}

export const setRefreshToken = async ({
  userId,
  refreshToken = uuidv4()
}: {
  userId: string
  refreshToken: string
}) => {
  await gqlSDK.insertAuthRefreshToken({
    refreshToken: {
      userId,
      refreshToken,
      expiresAt: new Date(newRefreshExpiry())
    }
  })

  return refreshToken
}

export const userIsAnonymous = async (userId: string) => {
  const { user } = await gqlSDK.user({
    id: userId
  })

  return user?.isAnonymous
}

export const getGravatarUrl = (email?: string) => {
  if (APPLICATION.GRAVATAR_ENABLED && email) {
    return gravatar.url(email, {
      r: APPLICATION.RATING,
      protocol: 'https',
      default: APPLICATION.GRAVATAR_DEFAULT
    })
  }
}

export const deanonymizeUser = async (user: UserFieldsFragment) => {
  // Gravatar is enabled and anonymous user has not added
  // an avatar yet
  const useGravatar = APPLICATION.GRAVATAR_ENABLED && !user.avatarURL

  // update user
  user.avatarURL = !useGravatar ? user.avatarURL : getGravatarUrl(user.email)
  user.defaultRole = REGISTRATION.DEFAULT_USER_ROLE

  user.active = true

  const userRoles = REGISTRATION.DEFAULT_ALLOWED_USER_ROLES.map((role) => ({
    userId: user.id,
    createdAt: new Date(),
    role
  }))

  await gqlSDK.deanonymizeUser({
    userId: user.id,
    user,
    userRoles
  })
}

export const isAllowedEmail = async (email: string) => {
  const { AuthWhitelist } = await gqlSDK.isEmailInWhitelist({
    email
  })

  return !!AuthWhitelist
}
