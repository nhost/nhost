export const NHOST_REFRESH_TOKEN_KEY = 'nhostRefreshToken'
export const NHOST_JWT_EXPIRES_AT_KEY = 'nhostRefreshTokenExpiresAt'

export const MIN_PASSWORD_LENGTH = 3

// * Minimum time in seconds before the JWT expiration and the first refresh attempt
export const TOKEN_REFRESH_MARGIN = 900

// * Minimum time in seconds for a refresh regardless ot the JWT expiration
export const MIN_TOKEN_REFRESH_INTERVAL = 60

// * Number of seconds before retrying a token refresh after an error
export const REFRESH_TOKEN_RETRY_INTERVAL = 10

// * Maximum number of attempts to refresh a token before stopping the timer and logging out
// TODO try when offline for a long time: maybe we could keep state as 'signedIn'
export const REFRESH_TOKEN_RETRY_MAX_ATTEMPTS = 30
