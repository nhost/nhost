import {
  NhostAuthConstructorParams,
  NhostClient as VanillaClient,
  removeParameterFromWindow,
  ServiceUrls,
  Subdomain
} from '@nhost/nhost-js'
import { App, warn } from 'vue'
import { DefaultNhostClient } from './useNhostClient'

export type { ErrorPayload, NhostSession, Subdomain, User } from '@nhost/nhost-js'

export interface NhostVueClientConstructorParams
  extends Partial<Subdomain>,
    Partial<ServiceUrls>,
    Omit<NhostAuthConstructorParams, 'url' | 'start' | 'client'> {}

export class NhostClient extends VanillaClient {
  private autoSignIn: boolean
  constructor(params: NhostVueClientConstructorParams) {
    super({ ...params, start: true })
    this.autoSignIn = params.autoSignIn ?? true
  }

  /**
   * @internal
   * This method transforms the NhostClient class into a Vue plugin
   */
  install(app: App) {
    const autoSignIn = this.autoSignIn
    app.provide(DefaultNhostClient, this)
    // * Remove the refreshToken & type from the hash when using Vue Router
    if (autoSignIn) {
      const router = app.config.globalProperties.$router
      if (!router) {
        // * Vue-router is not set. Do nothing.
        return
      }
      if (router.options.history.base) {
        warn(
          '[Nhost]: Vue-router is configured with a history Hash Mode. Refresh tokens will not be removed from the hash.'
        )
        return
      }
      router.afterEach(() => {
        removeParameterFromWindow('refreshToken')
        removeParameterFromWindow('type')
      })
    }
  }
}
