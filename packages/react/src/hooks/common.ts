import { useContext } from 'react'
import { InterpreterFrom } from 'xstate'

import { Nhost, NhostMachine } from '@nhost/client'
import { useSelector } from '@xstate/react'

import { NhostReactContext } from '../provider'

export const useNhost = (): Nhost => {
  const nhost = useContext(NhostReactContext)
  return nhost
}

export const useNhostInterpreter = (): InterpreterFrom<NhostMachine> => {
  const nhost = useContext(NhostReactContext)
  if (!nhost.interpreter) throw Error('No interpreter')
  return nhost.interpreter
}

export const useNhostBackendUrl = () => {
  const nhost = useContext(NhostReactContext)
  return nhost.backendUrl
}

export const useReady = () => {
  const service = useNhostInterpreter()
  return useSelector(service, (state) => state.hasTag('ready'))
}

export const useLoading = () => !useReady()

export const useAuthenticated = () => {
  const service = useNhostInterpreter()
  return useSelector(service, (state) => state.matches({ authentication: 'signedIn' }))
}

export const useNhostAuth = () => {
  const service = useNhostInterpreter()
  return useSelector(service, (state) => ({
    isLoading: !state.hasTag('ready'),
    isAuthenticated: state.matches({ authentication: 'signedIn' })
  }))
}

export const useAccessToken = () => {
  const service = useNhostInterpreter()
  return useSelector(service, (state) => state.context.accessToken.value)
}

export const useSignOut = (stateAll?: boolean) => {
  const service = useNhostInterpreter()
  const signOut = (valueAll = false) => service.send({ type: 'SIGNOUT', all: valueAll ?? stateAll })
  const success = useSelector(service, (state) => state.matches({ authentication: 'signedOut' }))
  return { signOut, success }
}
