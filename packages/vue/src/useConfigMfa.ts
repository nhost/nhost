import { ToRefs, unref } from 'vue'

import { createEnableMfaMachine, ErrorPayload } from '@nhost/core'
import { useMachine, useSelector } from '@xstate/vue'

import { RefOrValue } from './helpers'
import { useNhostClient } from './useNhostClient'

interface ActivateMfaComposableState {
  isActivating: boolean
  isActivated: boolean
  isError: boolean
  error: ErrorPayload | null
}
interface GenerateQrCodeComposableState {
  qrCodeDataUrl: string
  isGenerating: boolean
  isGenerated: boolean
  isError: boolean
  error: ErrorPayload | null
}

type ActivateMfaHandlerResult = Omit<ActivateMfaComposableState, 'isActivating'>
type ActivateMfaHandler = (code: string) => Promise<ActivateMfaHandlerResult>

type GenerateQrCodeHandlerResult = Omit<GenerateQrCodeComposableState, 'isGenerating'>
type GenerateQrCodeHandler = () => Promise<GenerateQrCodeHandlerResult>

interface ConfigMfaComposableState
  extends ToRefs<ActivateMfaComposableState>,
    ToRefs<GenerateQrCodeComposableState> {
  generateQrCode: GenerateQrCodeHandler
  activateMfa: ActivateMfaHandler
}

/**
 * @internal
 * TODO documentation when available in Nhost Cloud - see changelog
 * TODO use a common reactive 'result' state - see for instance useChangeEmail
 * @returns
 */
export const useConfigMfa = (): ConfigMfaComposableState => {
  const { client } = useNhostClient()

  const { send, service } = useMachine(createEnableMfaMachine(client.auth.client))

  const isError = useSelector(
    service,
    (state) => state.matches({ idle: 'error' }) || state.matches({ generated: { idle: 'error' } })
  )
  const isGenerating = useSelector(service, (state) => state.matches('generating'))
  const isGenerated = useSelector(service, (state) => state.matches('generated'))
  const isActivating = useSelector(service, (state) => state.matches({ generated: 'activating' }))
  const isActivated = useSelector(service, (state) => state.matches({ generated: 'activated' }))
  const error = useSelector(service, (state) => state.context.error)
  const qrCodeDataUrl = useSelector(service, (state) => state.context.imageUrl || '')

  const generateQrCode = () =>
    new Promise<GenerateQrCodeHandlerResult>((resolve) => {
      send('GENERATE')
      service.onTransition((state) => {
        if (state.matches('generated')) {
          resolve({
            error: null,
            isError: false,
            isGenerated: true,
            qrCodeDataUrl: state.context.imageUrl || ''
          })
        } else if (state.matches({ idle: 'error' })) {
          resolve({
            error: state.context.error || null,
            isError: true,
            isGenerated: false,
            qrCodeDataUrl: ''
          })
        }
      })
    })
  const activateMfa = (code: RefOrValue<string>) =>
    new Promise<ActivateMfaHandlerResult>((resolve) => {
      send({
        type: 'ACTIVATE',
        activeMfaType: 'totp',
        code: unref(code)
      })
      service.onTransition((state) => {
        if (state.matches({ generated: 'activated' })) {
          resolve({ error: null, isActivated: true, isError: false })
        } else if (state.matches({ generated: { idle: 'error' } })) {
          resolve({ error: state.context.error, isActivated: false, isError: true })
        }
      })
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
