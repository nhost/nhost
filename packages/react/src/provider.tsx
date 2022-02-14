import React, { createContext } from 'react'
import { InterpreterFrom } from 'xstate'

import { Nhost, NhostMachine } from '@nhost/core'

type Context = {
  interpreter: InterpreterFrom<NhostMachine>
  backendUrl: string
}

export const NhostContext = createContext<Context>({} as Context)

export const NhostProvider: React.FC<{ nhost: Nhost }> = ({ nhost, ...props }) => {
  return <NhostContext.Provider value={nhost}>{props.children}</NhostContext.Provider>
}
