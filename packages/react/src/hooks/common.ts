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

export const useLoading = () => {
  const service = useNhostInterpreter()
  return useSelector(service, (state) => !state.hasTag('ready'))
}

export const useAuthenticated = () => {
  const service = useNhostInterpreter()
  return useSelector(service, (state) => state.matches({ authentication: 'signedIn' }))
}

// ! TODO not working!!!!!
// export const useNhostAuth = () => {
//   const service = useNhostInterpreter()
//   return useSelector(service, (state) => ({
//     isLoading: !state.hasTag('ready'),
//     isAuthenticated: state.matches({ authentication: 'signedIn' })
//   }))
// }

export const useAccessToken = () => {
  const service = useNhostInterpreter()
  return useSelector(service, (state) => state.context.accessToken.value)
}

export const useSignOut = (stateAll: boolean = false) => {
  const service = useNhostInterpreter()
  const signOut = (valueAll?: boolean | unknown) =>
    service.send({ type: 'SIGNOUT', all: typeof valueAll === 'boolean' ? valueAll : stateAll })
  const isSuccess = useSelector(service, (state) =>
    state.matches({ authentication: { signedOut: 'success' } })
  )
  return { signOut, isSuccess }
}
