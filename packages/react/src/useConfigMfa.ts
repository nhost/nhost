import {
  ActivateMfaHandlerResult,
  activateMfaPromise,
  ActivateMfaState,
  createEnableMfaMachine,
  DisableMfaHandlerResult,
  disableMfaPromise,
  GenerateQrCodeHandlerResult,
  generateQrCodePromise,
  GenerateQrCodeState
} from '@nhost/nhost-js'
import { useInterpret, useSelector } from '@xstate/react'
import { useMemo } from 'react'
import { useNhostClient } from './useNhostClient'

interface ConfigMfaState extends ActivateMfaState, GenerateQrCodeState {
  generateQrCode: () => Promise<GenerateQrCodeHandlerResult>
  activateMfa: (code: string) => Promise<ActivateMfaHandlerResult>
  disableMfa: (code: string) => Promise<DisableMfaHandlerResult>
  isDisabling: boolean
}

// TODO documentation when available in Nhost Cloud - see changelog
export const useConfigMfa = (): ConfigMfaState => {
  const nhost = useNhostClient()

  const machine = useMemo(() => createEnableMfaMachine(nhost.auth.client), [nhost])
  const service = useInterpret(machine)

  const isError = useSelector(
    service,
    (state) => state.matches({ idle: 'error' }) || state.matches({ generated: { idle: 'error' } })
  )
  const isGenerating = useSelector(service, (state) => state.matches('generating'))
  const isGenerated = useSelector(service, (state) => state.matches('generated'))
  const isActivating = useSelector(service, (state) => state.matches({ generated: 'activating' }))
  const isActivated = useSelector(service, (state) => state.matches({ generated: 'activated' }))
  const isDisabling = useSelector(service, (state) => state.matches('disabling'))
  const error = useSelector(service, (state) => state.context.error)
  const qrCodeDataUrl = useSelector(service, (state) => state.context.imageUrl || '')
  const totpSecret = useSelector(service, (state) => state.context.secret || '')

  const generateQrCode = () => generateQrCodePromise(service)

  const activateMfa = (code: string) => activateMfaPromise(service, code)
  const disableMfa = (code: string) => disableMfaPromise(service, code)

  return {
    generateQrCode,
    isGenerating,
    qrCodeDataUrl,
    isGenerated,
    activateMfa,
    isActivating,
    isActivated,
    isDisabling,
    isError,
    error,
    disableMfa,
    totpSecret
  }
}
