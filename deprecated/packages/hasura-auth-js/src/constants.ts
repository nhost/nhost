export const NHOST_REFRESH_TOKEN_KEY = 'nhostRefreshToken'
export const NHOST_REFRESH_TOKEN_ID_KEY = 'nhostRefreshTokenId'
export const NHOST_JWT_EXPIRES_AT_KEY = 'nhostRefreshTokenExpiresAt'

export const MIN_PASSWORD_LENGTH = 3

/**
 * Minimum time in seconds between now and the JWT expiration time before the JWT is refreshed
 * For instance, if set to 60, the client will refresh the JWT one minute before it expires
 */
export const TOKEN_REFRESH_MARGIN_SECONDS = 60

export const REFRESH_TOKEN_MAX_ATTEMPTS = 5
