import { computed, unref } from 'vue'

import { createEnableMfaMachine } from '@nhost/core'
import { useMachine } from '@xstate/vue'

import { RefOrValue } from './helpers'
import { useNhostClient } from './useNhostClient'

// TODO documentation when available in Nhost Cloud - see changelog
export const useConfigMfa = () => {
  const { client } = useNhostClient()

  const { state, send } = useMachine(createEnableMfaMachine(client.auth.client))

  const isError = computed(() => {
    state.value.matches({ idle: 'error' }) || state.value.matches({ generated: { idle: 'error' } })
  })
  const isGenerating = computed(() => state.value.matches('generating'))
  const isGenerated = computed(() => state.value.matches('generated'))
  const isActivating = computed(() => state.value.matches({ generated: 'activating' }))
  const isActivated = computed(() => state.value.matches({ generated: 'activated' }))
  const error = computed(() => state.value.context.error)
  const qrCodeDataUrl = computed(() => state.value.context.imageUrl || '')

  const generateQrCode = () => send('GENERATE')
  const activateMfa = (code: RefOrValue<string>) =>
    send({
      type: 'ACTIVATE',
      activeMfaType: 'totp',
      code: unref(code)
    })
  return {
    generateQrCode,
    isGenerating,
    qrCodeDataUrl,
    isGenerated,
    activateMfa,
    isActivating,
    isActivated,
    isError,
    error
  }
}
