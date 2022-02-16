import { useContext } from 'react'
import { InterpreterFrom } from 'xstate'

import { NhostMachine } from '@nhost/core'
import { useSelector } from '@xstate/react'

import { NhostReactContext } from '../provider'

export const useNhostInterpreter = (): InterpreterFrom<NhostMachine> => {
  const globalServices = useContext(NhostReactContext)
  return globalServices.interpreter
}

export const useNhostBackendUrl = () => {
  const globalServices = useContext(NhostReactContext)
  return globalServices.backendUrl
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
  return useSelector(service, (state) => state.context.accessToken)
}

export const useSignOut = (all = false) => {
  const service = useNhostInterpreter()
  const signOut = () => service.send({ type: 'SIGNOUT', all })
  const success = useSelector(service, (state) => state.matches({ authentication: 'signedOut' }))
  return { signOut, success }
}
