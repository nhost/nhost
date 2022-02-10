import { useInterpret } from '@xstate/react'
import { inspect } from '@xstate/inspect'
import React, { createContext } from 'react'
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

  return (
    <NhostContext.Provider value={{ authService, backendUrl }}>
      {props.children}
    </NhostContext.Provider>
  )
}
