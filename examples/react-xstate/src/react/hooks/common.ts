import { useSelector, useActor } from '@xstate/react'
import { useContext } from 'react'

import { NhostContext } from '../provider'

export const useAuthService = () => {
  const globalServices = useContext(NhostContext)
  return globalServices.authService
}

export const useNhostbackendUrl = () => {
  const globalServices = useContext(NhostContext)
  return globalServices.backendUrl
}

export const useAuthActor = () => {
  const service = useAuthService()
  return useActor(service)
}

export const useReady = () => {
  const service = useAuthService()
  return useSelector(service, (state) => state.hasTag('ready'))
}

export const useLoading = () => !useReady()

export const useAuthenticated = () => {
  const service = useAuthService()
  return useSelector(service, (state) => state.matches({ authentication: 'signedIn' }))
}

export const useNhostAuth = () => {
  const service = useAuthService()
  return useSelector(service, (state) => ({
    isLoading: !state.hasTag('ready'),
    isAuthenticated: state.matches({ authentication: 'signedIn' })
  }))
}

export const useAccessToken = () => {
  const service = useAuthService()
  return useSelector(service, (state) => state.context.accessToken)
}

export const useSignOut = (all = false) => {
  const service = useAuthService()
  const signOut = () => service.send({ type: 'SIGNOUT', all })
  const success = useSelector(service, (state) => state.matches({ authentication: 'signedOut' }))
  return { signOut, success }
}

export const useRefreshToken = (): [string | null, (v: string) => void] => {
  const service = useAuthService()
  const value = useSelector(service, (state) => state.context.accessToken)
  const setValue = (token: string) => {
    service.send({ type: 'LOAD_TOKEN', data: { refreshToken: token } })
  }
  return [value, setValue]
}
