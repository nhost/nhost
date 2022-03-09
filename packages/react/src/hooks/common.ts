import { useContext } from 'react'

import { AuthInterpreter } from '@nhost/core'
import { NhostClient } from '@nhost/nhost-js'
import { useSelector } from '@xstate/react'

import { NhostReactContext } from '../provider'

export const useNhost = (): NhostClient => {
  const nhost = useContext(NhostReactContext)
  return nhost
}

export const useAuthInterpreter = (): AuthInterpreter => {
  const nhost = useContext(NhostReactContext)
  const interpreter = nhost.auth.client.interpreter
  if (!interpreter) throw Error('No interpreter')
  return interpreter
}

export const useNhostBackendUrl = () => {
  const nhost = useContext(NhostReactContext)
  return nhost.auth.client.backendUrl
}

export const useAuthLoading = () => {
  const service = useAuthInterpreter()
  return useSelector(service, (state) => !state.hasTag('ready'))
}

export const useAuthenticated = () => {
  const service = useAuthInterpreter()
  return useSelector(service, (state) => state.matches({ authentication: 'signedIn' }))
}

// ! TODO not working!!!!!
// export const useNhostAuth = () => {
//   const service = useAuthInterpreter()
//   return useSelector(service, (state) => ({
//     isLoading: !state.hasTag('ready'),
//     isAuthenticated: state.matches({ authentication: 'signedIn' })
//   }))
// }

export const useAccessToken = () => {
  const service = useAuthInterpreter()
  return useSelector(service, (state) => state.context.accessToken.value)
}

export const useSignOut = (stateAll: boolean = false) => {
  const service = useAuthInterpreter()
  const signOut = (valueAll?: boolean | unknown) =>
    service.send({ type: 'SIGNOUT', all: typeof valueAll === 'boolean' ? valueAll : stateAll })
  const isSuccess = useSelector(service, (state) =>
    state.matches({ authentication: { signedOut: 'success' } })
  )
  return { signOut, isSuccess }
}
