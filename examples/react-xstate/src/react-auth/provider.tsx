import { useInterpret } from '@xstate/react'
import { inspect } from '@xstate/inspect'
import React, { useEffect, createContext } from 'react'
import { useLocation } from 'react-use'
import { InterpreterFrom } from 'xstate'

import { NhostMachine } from '../state'

if (process.env.NODE_ENV) {
  inspect({
    url: 'https://statecharts.io/inspect',
    iframe: false
  })
}

type Context = {
  authService: InterpreterFrom<NhostMachine>
  backendUrl: string
}

export const NhostContext = createContext<Context>({} as Context)

export const NhostProvider: React.FC<{ nhost: { machine: NhostMachine; backendUrl: string } }> = ({
  nhost: { machine, backendUrl },
  ...props
}) => {
  const authService = useInterpret(machine, { devTools: !!process.env.NODE_ENV })

  const location = useLocation()

  useEffect(() => {
    if (!location.hash) return
    const params = new URLSearchParams(location.hash.slice(1))
    const token = params.get('refreshToken')
    if (token) {
      const type = params.get('type')
      if (type === 'signinPasswordless') {
        authService.send({ type: 'UPDATE_REFRESH_TOKEN', token })
      } else {
        console.warn(
          `Found a refresh token in the url but the redirect type is not implemented: ${type}`
        )
      }
    }
  }, [location, authService])

  return (
    <NhostContext.Provider value={{ authService, backendUrl }}>
      {props.children}
    </NhostContext.Provider>
  )
}
