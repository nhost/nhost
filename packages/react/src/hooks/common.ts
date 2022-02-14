import { useContext } from 'react'

import { useActor, useSelector } from '@xstate/react'

import { NhostContext } from '../provider'

export const useNhostInterpreter = () => {
  const globalServices = useContext(NhostContext)
  return globalServices.interpreter
}

export const useNhostBackendUrl = () => {
  const globalServices = useContext(NhostContext)
  return globalServices.backendUrl
}

export const useAuthActor = () => {
  const service = useNhostInterpreter()
  return useActor(service)
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
