import {
  ActivateMfaHandlerResult,
  activateMfaPromise,
  ActivateMfaState,
  createEnableMfaMachine,
  GenerateQrCodeHandlerResult,
  generateQrCodePromise,
  GenerateQrCodeState
} from '@nhost/nhost-js'
import { useInterpret, useSelector } from '@xstate/vue'
import { ToRefs, unref } from 'vue'
import { RefOrValue } from './helpers'
import { useNhostClient } from './useNhostClient'

export interface ConfigMfaComposableState
  extends ToRefs<ActivateMfaState>,
    ToRefs<GenerateQrCodeState> {
  generateQrCode: () => Promise<GenerateQrCodeHandlerResult>
  activateMfa: (code: string) => Promise<ActivateMfaHandlerResult>
}

/**
 * @internal
 * TODO documentation when available in Nhost Cloud - see changelog
 * TODO use a common reactive 'result' state - see for instance useChangeEmail
 * TODO use the promise action
 * @returns
 */
export const useConfigMfa = (): ConfigMfaComposableState => {
  const { nhost } = useNhostClient()

  const service = useInterpret(createEnableMfaMachine(nhost.auth.client))

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

  const generateQrCode = () => generateQrCodePromise(service)

  const activateMfa = (code: RefOrValue<string>) => activateMfaPromise(service, unref(code))

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
