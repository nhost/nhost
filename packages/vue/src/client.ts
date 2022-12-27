import {
  BackendUrl,
  NhostAuthConstructorParams,
  NhostClient as VanillaClient,
  Subdomain
} from '@nhost/nhost-js'
import { App } from 'vue'
import { DefaultNhostClient } from './useNhostClient'

export interface NhostVueClientConstructorParams
  extends Partial<BackendUrl>,
    Partial<Subdomain>,
    Omit<NhostAuthConstructorParams, 'url' | 'start' | 'client'> {}

export class NhostClient extends VanillaClient {
  constructor(params: NhostVueClientConstructorParams) {
    super({ ...params, start: true })
  }

  /**
   * @internal
   * This method transforms the NhostClient class into a Vue plugin
   */
  install(app: App) {
    app.provide(DefaultNhostClient, this)
  }
}
