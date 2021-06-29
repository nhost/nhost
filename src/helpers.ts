import { APPLICATION, JWT, REGISTRATION } from '@config/index'
import { NextFunction, Response, Request } from 'express'
import {
  deanonymizeAccount as deanonymizeAccountQuery,
  insertRefreshToken,
  rotateTicket as rotateTicketQuery,
  selectAccountByEmail as selectAccountByEmailQuery,
  selectAccountByTicket as selectAccountByTicketQuery,
  selectAccountByUserId as selectAccountByUserIdQuery,
  isAllowedEmail as isAllowedEmailQuery,
  updateLastSentConfirmation as updateLastSentConfirmationQuery,
} from './queries'
import * as gravatar from 'gravatar'
import QRCode from 'qrcode'
import bcrypt from 'bcryptjs'
import { pwnedPassword } from 'hibp'
import { request } from './request'
import { v4 as uuidv4 } from 'uuid'
import { AccountData, IsAllowedEmail, QueryAccountData } from './types'

/**
 * Create QR code.
 * @param secret Required OTP secret.
 */
export function createQR(secret: string): Promise<string> {
  return QRCode.toDataURL(secret)
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

export const selectAccountByEmail = async (email: string): Promise<AccountData|null> => {
  const hasuraData = await request<QueryAccountData>(selectAccountByEmailQuery, { email })
  if (!hasuraData.auth_accounts[0]) return null
  return hasuraData.auth_accounts[0]
}

export const selectAccountByTicket = async (ticket: string): Promise<AccountData|null> => {
  const hasuraData = await request<QueryAccountData>(selectAccountByTicketQuery, {
    ticket,
    now: new Date()
  })
  if (!hasuraData.auth_accounts[0]) return null
  return hasuraData.auth_accounts[0]
}

// TODO await request returns undefined if no user found!
export const selectAccountByUserId = async (user_id: string | undefined): Promise<AccountData> => {
  if (!user_id) {
    throw new Error('Invalid User Id')
  }
  const hasuraData = await request<QueryAccountData>(selectAccountByUserIdQuery, { user_id })
  if (!hasuraData.auth_accounts[0]) throw new Error('Account does not exist')
  return hasuraData.auth_accounts[0]
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
export const isCompromisedPassword = async (password: string): Promise<boolean> => {
  return !!(REGISTRATION.HIBP_ENABLED && (await pwnedPassword(password)))
}

export const rotateTicket = async (ticket: string): Promise<string> => {
  const new_ticket = uuidv4()
  await request(rotateTicketQuery, {
    ticket,
    now: new Date(),
    new_ticket
  })
  return new_ticket
}

export function newRefreshExpiry(): number {
  const now = new Date()
  // 1 day = 1440 minutes
  const days = JWT.REFRESH_EXPIRES_IN / 1440

  return now.setDate(now.getDate() + days)
}

interface InsertRefreshTokenData {
  insert_auth_refresh_tokens_one: {
    account: AccountData
  }
}

export const setRefreshToken = async (
  accountId: string,
  refresh_token = uuidv4()
): Promise<string> => {

  await request<InsertRefreshTokenData>(insertRefreshToken, {
    refresh_token_data: {
      account_id: accountId,
      refresh_token,
      expires_at: new Date(newRefreshExpiry())
    }
  })

  return refresh_token
}

export const accountWithEmailExists = async (email: string) => {
  return !!await selectAccountByEmail(email)
}

export const accountIsAnonymous = async (user_id: string) => {
  const account = await selectAccountByUserId(user_id)

  return account.is_anonymous
}

export const getGravatarUrl = (email?: string) => {
  if(APPLICATION.GRAVATAR_ENABLED && email) {
    return gravatar.url(email, {
      r: APPLICATION.RATING,
      protocol: 'https',
      default: APPLICATION.GRAVATAR_DEFAULT
    })
  }
}

export const deanonymizeAccount = async (account: AccountData) => {
  // Gravatar is enabled and anonymous user has not added
  // an avatar yet
  const useGravatar = APPLICATION.GRAVATAR_ENABLED && !account.user.avatar_url

  await request(deanonymizeAccountQuery, {
    account_id: account.id,
    account: {
      default_role: REGISTRATION.DEFAULT_USER_ROLE,
      active: true
    },
    ...(useGravatar && {
      user_id: account.user.id,
      user: {
        avatar_url: getGravatarUrl(account.email)
      }
    }),
    roles: REGISTRATION.DEFAULT_ALLOWED_USER_ROLES.map(role => ({
      account_id: account.id,
      created_at: new Date(),
      role
    }))
  })
}

export const updateLastSentConfirmation = async (user_id: string): Promise<void> => {
  await request(updateLastSentConfirmationQuery, {
    user_id,
    last_confirmation_email_sent_at: new Date(+Date.now() + REGISTRATION.CONFIRMATION_RESET_TIMEOUT)
  })
}

export const isAllowedEmail = async (email: string) => {
  return request<IsAllowedEmail>(isAllowedEmailQuery, {
    email
  }).then(q => !!q.auth_whitelist_by_pk)
}
