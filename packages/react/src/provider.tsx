import React, { createContext } from 'react'
import { InterpreterFrom } from 'xstate'

import { Nhost, NhostContext, NhostMachine } from '@nhost/core'
import { useInterpret } from '@xstate/react'

type Context = Nhost & {
  interpreter: InterpreterFrom<NhostMachine>
}
export const NhostReactContext = createContext<Context>({} as Context)

export const NhostProvider: React.FC<{ nhost: Nhost; initialContext?: NhostContext }> = ({
  nhost,
  initialContext,
  ...props
}) => {
  const interpreter = useInterpret(nhost.machine, {
    devTools: typeof window !== 'undefined' && process.env.NODE_ENV === 'development',
    ...(initialContext ? { context: initialContext } : {})
  })
  const value = { ...nhost, interpreter }
  return <NhostReactContext.Provider value={value}>{props.children}</NhostReactContext.Provider>
}
