import { useInterpret } from '@xstate/react'
import { inspect } from '@xstate/inspect'
import React, { useEffect, createContext } from 'react'
import { useLocation } from 'react-use'
import { InterpreterFrom } from 'xstate'

import { Nhost, NhostMachine } from '../nhost'

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

export const NhostProvider: React.FC<{ nhost: Nhost }> = ({
  nhost: { machine, backendUrl },
  ...props
}) => {
  const authService = useInterpret(machine, { devTools: !!process.env.NODE_ENV })

  const location = useLocation()

  // TODO no need to wrap it into an effect - run it once on startup
  useEffect(() => {
    if (!location.hash) return
    const params = new URLSearchParams(location.hash.slice(1))
    const token = params.get('refreshToken')
    if (token) {
      const type = params.get('type')
      if (
        type === 'signinPasswordless' ||
        type === 'emailVerify' ||
        type === 'emailConfirmChange'
      ) {
        console.log('HERE', token)
        // TODO send somehow the information to other tabs
        authService.send({ type: 'LOAD_TOKEN', data: { refreshToken: token } })
        // * remove hash from the current url after consumming the token
        window.history.pushState({}, '', location.pathname)
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
