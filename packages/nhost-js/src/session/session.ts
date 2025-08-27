import type { Session as AuthSession } from '../auth'

/**
 * Decoded JWT token payload with processed timestamps and Hasura claims
 */
export interface DecodedToken {
  /** Token expiration time as Date object */
  exp?: number
  /** Token issued at time as Date object */
  iat?: number
  /** Token issuer */
  iss?: string
  /** Token subject (user ID) */
  sub?: string
  /** Hasura JWT claims with PostgreSQL arrays converted to JavaScript arrays */
  'https://hasura.io/jwt/claims'?: Record<string, unknown>
  /** Any other JWT claims */
  [key: string]: unknown
}

export interface Session extends AuthSession {
  /** Decoded JWT token payload with processed timestamps and Hasura claims */
  decodedToken: DecodedToken
}

export const decodeUserSession = (accessToken: string): DecodedToken => {
  const s = accessToken.split('.')
  if (s.length !== 3 || !s[1]) {
    throw new Error('Invalid access token format')
  }

  const decodedToken = JSON.parse(
    typeof atob !== 'undefined' ? atob(s[1]) : Buffer.from(s[1], 'base64').toString('utf-8')
  ) as Record<string, unknown>

  // Convert iat and exp to Date objects
  const iat =
    typeof decodedToken['iat'] === 'number'
      ? decodedToken['iat'] * 1000 // Convert seconds to milliseconds
      : undefined
  const exp =
    typeof decodedToken['exp'] === 'number'
      ? decodedToken['exp'] * 1000 // Convert seconds to milliseconds
      : undefined

  // Process Hasura claims - dynamically convert PostgreSQL array notation to arrays
  const hasuraClaims = decodedToken['https://hasura.io/jwt/claims'] as
    | Record<string, unknown>
    | undefined
  const processedClaims = hasuraClaims
    ? Object.entries(hasuraClaims).reduce(
        (acc, [key, value]) => {
          if (typeof value === 'string' && isPostgresArray(value)) {
            acc[key] = parsePostgresArray(value)
          } else {
            acc[key] = value
          }
          return acc
        },
        {} as Record<string, unknown>
      )
    : undefined

  return {
    ...decodedToken,
    iat,
    exp,
    'https://hasura.io/jwt/claims': processedClaims
  }
}

const isPostgresArray = (value: string): boolean => {
  return value.startsWith('{') && value.endsWith('}')
}

const parsePostgresArray = (value: string): string[] => {
  if (!value || value === '{}') return []
  // Remove curly braces and split by comma, handling quoted values
  return value
    .slice(1, -1)
    .split(',')
    .map((item) => item.trim().replace(/^"(.*)"$/, '$1'))
}
