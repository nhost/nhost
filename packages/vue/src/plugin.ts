import { Plugin } from 'vue'

import { NhostClient } from './client'
import { DefaultNhostClient } from './useNhostClient'

export const NhostPlugin: Plugin = {
  install: (app, options: { nhost: NhostClient }) => {
    app.provide(DefaultNhostClient, options.nhost)
  }
}
