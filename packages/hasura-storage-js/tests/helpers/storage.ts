import { ClientStorage, NHOST_REFRESH_TOKEN_KEY, NHOST_JWT_EXPIRES_AT_KEY } from '@nhost/core'

/**
 * Custom emory storage implementation that always return a mock refresh token
 */
export const clientStorage: ClientStorage = {
  getItem: (key: string) =>
    ({
      [NHOST_REFRESH_TOKEN_KEY]: 'mockRefreshTokenValue',
      [NHOST_JWT_EXPIRES_AT_KEY]: Date.now().toString()
    }[key]),
  setItem: () => {},
  removeItem: () => {}
}
