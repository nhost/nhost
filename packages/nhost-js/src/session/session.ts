import type { Session as AuthSession } from '../auth';

/**
 * Decoded JWT token payload with processed timestamps and Hasura claims
 */
export interface DecodedToken {
  /** Token expiration time as Date object */
  exp?: number;
  /** Token issued at time as Date object */
  iat?: number;
  /** Token issuer */
  iss?: string;
  /** Token subject (user ID) */
  sub?: string;
  /** Hasura JWT claims with PostgreSQL arrays converted to JavaScript arrays */
  'https://hasura.io/jwt/claims'?: Record<string, unknown>;
  /** Any other JWT claims */
  [key: string]: unknown;
}

export interface Session extends AuthSession {
  /** Decoded JWT token payload with processed timestamps and Hasura claims */
  decodedToken: DecodedToken;
}

/**
 * Decodes a base64url-encoded string (RFC 4648 Section 5) to a UTF-8 string.
 *
 * JWTs use base64url encoding, which differs from standard base64 by using
 * `-` and `_` instead of `+` and `/`, and omitting padding. The browser's
 * native `atob()` does not support base64url, so we must handle the conversion.
 */
const decodeBase64Url = (input: string): string => {
  // Convert base64url to standard base64
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad) {
    base64 += '='.repeat(4 - pad);
  }

  // Use TextDecoder for proper UTF-8 support (atob alone mangles multi-byte characters)
  const binaryString = atob(base64);
  const bytes = Uint8Array.from(binaryString, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export const decodeUserSession = (accessToken: string): DecodedToken => {
  const s = accessToken.split('.');
  if (s.length !== 3 || !s[1]) {
    throw new Error('Invalid access token format');
  }

  const decodedToken = JSON.parse(decodeBase64Url(s[1])) as Record<
    string,
    unknown
  >;

  // Convert iat and exp to Date objects
  const iat =
    typeof decodedToken['iat'] === 'number'
      ? decodedToken['iat'] * 1000 // Convert seconds to milliseconds
      : undefined;
  const exp =
    typeof decodedToken['exp'] === 'number'
      ? decodedToken['exp'] * 1000 // Convert seconds to milliseconds
      : undefined;

  // Process Hasura claims - dynamically convert PostgreSQL array notation to arrays
  const hasuraClaims = decodedToken['https://hasura.io/jwt/claims'] as
    | Record<string, unknown>
    | undefined;
  const processedClaims = hasuraClaims
    ? Object.entries(hasuraClaims).reduce(
        (acc, [key, value]) => {
          if (typeof value === 'string' && isPostgresArray(value)) {
            acc[key] = parsePostgresArray(value);
          } else {
            acc[key] = value;
          }
          return acc;
        },
        {} as Record<string, unknown>,
      )
    : undefined;

  return {
    ...decodedToken,
    iat,
    exp,
    'https://hasura.io/jwt/claims': processedClaims,
  };
};

const isPostgresArray = (value: string): boolean => {
  return value.startsWith('{') && value.endsWith('}');
};

const parsePostgresArray = (value: string): string[] => {
  if (!value || value === '{}') return [];
  // Remove curly braces and split by comma, handling quoted values
  return value
    .slice(1, -1)
    .split(',')
    .map((item) => item.trim().replace(/^"(.*)"$/, '$1'));
};
