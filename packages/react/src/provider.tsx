import React, { createContext } from 'react'

import { Nhost } from '@nhost/client'
import { useInterpret } from '@xstate/react'

export const NhostReactContext = createContext<Nhost>({} as Nhost)

// TODO initialContext must be possibly partial - use immer.produce
export const NhostProvider: React.FC<{
  nhost: Nhost
}> = ({ nhost, ...props }) => {
  const interpreter = useInterpret(nhost.machine, {
    devTools: typeof window !== 'undefined' && process.env.NODE_ENV === 'development'
  })
  nhost.interpreter = interpreter
  return <NhostReactContext.Provider value={nhost}>{props.children}</NhostReactContext.Provider>
}
