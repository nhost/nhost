export const NHOST_REFRESH_TOKEN_KEY = 'nhostRefreshToken'
export const NHOST_ACCESS_TOKEN_KEY = 'jwt'
export const NHOST_USER_KEY = 'user'

export const DEFAULT_ACCESS_TOKEN_EXPIRATION = 900
export const DEFAULT_REFRESH_TOKEN_EXPIRATION = 43200

export const MIN_PASSWORD_LENGTH = 3

// * Minimum number of seconds before the JWT expiration and the refresh
export const TOKEN_REFRESH_MARGIN = 900
// const TOKEN_REFRESH_MARGIN = 180
// export const MIN_TOKEN_REFRESH_INTERVAL = 60
export const MIN_TOKEN_REFRESH_INTERVAL = 10
export const REFRESH_TOKEN_RETRY_INTERVAL = 10
// const REFRESH_TOKEN_RETRY_INTERVAL = 5
export const REFRESH_TOKEN_RETRY_MAX_ATTEMPTS = 30
// const REFRESH_TOKEN_RETRY_MAX_ATTEMPTS = 10
