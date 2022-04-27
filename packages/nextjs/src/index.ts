import { AuthClientSSR } from '@nhost/core'
import { NhostClient as VanillaNhostClient, NhostClientConstructorParams } from '@nhost/nhost-js'

export * from './get-session'
export * from '@nhost/react'
export { NhostReactProvider as NhostNextProvider } from '@nhost/react'

export interface NhostNextClientConstructorParams
  extends Omit<
    NhostClientConstructorParams,
    'start' | 'clientStorage' | 'clientStorageType' | 'Client'
  > {}

export class NhostClient extends VanillaNhostClient {
  constructor(params: NhostNextClientConstructorParams) {
    super({ ...params, start: false, Client: AuthClientSSR })
  }
}
