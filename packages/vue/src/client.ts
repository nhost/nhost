import { ref } from 'vue'

import { NhostClient as VanillaClient, NhostClientConstructorParams } from '@nhost/nhost-js'

type NhostVueClientConstructorParams = Omit<NhostClientConstructorParams, 'start' | 'client'>

export const nhostClient = ref<NhostClient>()

export class NhostClient extends VanillaClient {
  constructor(params: NhostVueClientConstructorParams) {
    super({ ...params, start: true })
    nhostClient.value = this
  }
}
