import { ValidatedRequest, ValidatedRequestSchema } from 'express-joi-validation'
import { Maybe } from './utils/__generated__/graphql-request'

export type ClaimValueType =
  | string
  | string[]
  | number
  | number[]
  | RegExp
  | RegExp[]
  | boolean
  | boolean[]
  | null
  | undefined

/**
 * Claims interface.
 */
export interface Claims {
  'x-hasura-user-id': string
  'x-hasura-default-role': string
  'x-hasura-allowed-roles': string[]
  [key: string]: ClaimValueType
}

/**
 * PermissionVariables interface.
 */
export interface PermissionVariables {
  'user-id': string
  'default-role': string
  'allowed-roles': string[]
  [key: string]: ClaimValueType
}

/**
 * Token interface.
 */
export type Token = {
  [key: string]: Claims
} & {
  exp: bigint
  iat: bigint
  iss: string
  sub: string
}

export interface Session {
  JWTToken: string | null;
  JWTExpiresIn: number | null;
  refreshToken?: string
  user: UserData;
}

export interface UserData {
  [key: string]: ClaimValueType
  id: string
  email?: string
  displayName: Maybe<string> | undefined;
  avatarURL: Maybe<string> | undefined;
}

export interface AccountData {
  id: string
  user: UserData
  active: boolean
  default_role: string
  account_roles: { role: string }[]
  is_anonymous: boolean
  ticket?: string
  otp_secret?: string
  mfa_enabled: boolean
  password_hash: string
  email: string
  new_email?: string
  last_confirmation_email_sent_at: string
  locale: string
}

export interface QueryAccountData {
  auth_accounts: AccountData[]
}

export interface UpdateAccountData {
  update_auth_accounts: {
    affected_rows: number
    returning: {
      id: string
      user_id: string
    }[]
  }
}

export interface DeleteAccountData {
  delete_auth_accounts: { affected_rows: number }
}
interface AccountProvider {
  account: AccountData
}

export interface QueryAccountProviderData {
  auth_account_providers: AccountProvider[]
}

export interface InsertAccountData {
  insert_auth_accounts: {
    returning: AccountData[]
  }
}

export interface InsertAccountProviderToUser {
  insert_auth_account_providers_one: {
    account: AccountData
  }
}

export interface QueryProviderRequests {
  auth_provider_requests_by_pk: {
    redirect_url_success: string,
    redirect_url_failure: string,
    jwt_token?: string
  }
}

export interface SetNewEmailData {
  update_auth_accounts: {
    returning: {
      user: UserData
    }[]
    affected_rows: number
  }
}

export interface IsAllowedEmail {
  auth_whitelist_by_pk: {
    email: string
  } | null
}
export interface QueryEmailTemplate {
  auth_email_templates_by_pk: {
    title: string
    html: string
    no_html: string
  }
}
