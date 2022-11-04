import { NhostClient as VanillaClient, NhostClientConstructorParams } from '@nhost/nhost-js'

export class NhostClient extends VanillaClient {
  constructor(
    params: Omit<
      NhostClientConstructorParams,
      | 'adminSecret'
      | 'start'
      | 'autoRefreshToken'
      | 'backendUrl'
      | 'subdomain'
      | 'region'
      | 'refreshIntervalTime'
    >
  ) {
    super({
      ...params,
      start: true,
      backendUrl: process.env.NHOST_BACKEND_URL,
      subdomain: process.env.NHOST_SUBDOMAIN,
      region: process.env.NHOST_REGION,
      adminSecret: process.env.NHOST_ADMIN_SECRET
    })
  }
}
