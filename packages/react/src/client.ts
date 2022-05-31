import { NhostClient as VanillaClient, NhostClientConstructorParams } from '@nhost/nhost-js'

export interface NhostReactClientConstructorParams
  extends Omit<NhostClientConstructorParams, 'start' | 'client'> {}

export class NhostClient extends VanillaClient {
  constructor(params: NhostReactClientConstructorParams) {
    super({ ...params, start: false })
  }
}
