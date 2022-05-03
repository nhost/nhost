import { App, getCurrentInstance } from 'vue'
import { Router } from 'vue-router'

import { NhostClient as VanillaClient, NhostClientConstructorParams } from '@nhost/nhost-js'

import { DefaultNhostClient } from './useNhostClient'
type NhostVueClientConstructorParams = Omit<NhostClientConstructorParams, 'start' | 'client'>
export class NhostClient extends VanillaClient {
  constructor(params: NhostVueClientConstructorParams) {
    super({ ...params, start: true })
  }

  install(app: App) {
    app.provide(DefaultNhostClient, this)
    app.mixin({
      created() {
        const instance = getCurrentInstance()
        if (instance?.uid === instance?.root.uid) {
          const router: Router | undefined = this.$router
          router?.afterEach((to) => {
            if (to.hash.includes('refreshToken') || to.query['refreshToken']) {
              delete to.query['refreshToken']
              delete to.query['type']
              const hash = new URLSearchParams(to.hash.slice(1))
              if (hash.has('refreshToken')) {
                hash.delete('refreshToken')
                hash.delete('type')
              }
              let path = '/#' + to.path
              if (Object.keys(to.params).length) {
                path +=
                  '?' +
                  Object.entries(to.params)
                    .map(([key, value]) => `${key}=${value}`)
                    .join('&')
              }
              if (Array.from(hash).length) {
                path += '#' + hash.toString()
              }
              window.history.pushState({}, '', path)
            }
          })
        }
      }
    })
  }
}
