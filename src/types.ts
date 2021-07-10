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
  jwtToken: string
  jwtExpiresIn: number
  refreshToken?: string
  user: SessionUser;
}

export interface SessionUser {
  [key: string]: ClaimValueType
  id: string
  email?: string
  displayName?: Maybe<string>;
  avatarUrl?: Maybe<string>;
}
