import { assign } from '@xstate/immer'
import { ActionFunctionMap, StatesConfig } from 'xstate'
import { MIN_TOKEN_REFRESH_INTERVAL, NHOST_REFRESH_TOKEN, TOKEN_REFRESH_MARGIN } from '../constants'
import { NhostContext } from '../context'
import { StorageSetter } from '../storage'
import { newRefreshGuards, newRefreshTokenActions, newRefreshTokenConfig } from './new'
import { tokenRefresherActions, tokenRefresherConfig, tokenRefresherGuards } from './refresher'

export const tokenConfig: StatesConfig<NhostContext, any, any> = {
  ...tokenRefresherConfig,
  ...newRefreshTokenConfig
}

export const tokenActions = (
  storageSetter: StorageSetter
): ActionFunctionMap<NhostContext, any, any> => ({
  ...newRefreshTokenActions,
  ...tokenRefresherActions,

  // * Save information after receiving token information
  saveToken: assign((ctx, e) => {
    ctx.user = e.data.user
    ctx.accessToken.value = e.data.accessToken
    ctx.accessToken.expiresIn = Math.max(
      e.data.accessTokenExpiresIn - TOKEN_REFRESH_MARGIN,
      MIN_TOKEN_REFRESH_INTERVAL
    )
    ctx.refreshToken.value = e.data.refreshToken
  }),

  // * Persist the refresh token outside of the machine
  persistRefreshToken: (ctx) => {
    storageSetter(NHOST_REFRESH_TOKEN, ctx.refreshToken.value)
  }
})

export const tokenGuards: Record<string, (ctx: NhostContext, e: any) => boolean> = {
  ...newRefreshGuards,
  ...tokenRefresherGuards
}
