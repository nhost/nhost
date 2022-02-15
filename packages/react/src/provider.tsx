import React, { createContext } from 'react'

import { Nhost } from '@nhost/core'
import { useInterpret } from '@xstate/react'

type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] }

type Context = WithRequired<Nhost, 'interpreter'>

export const NhostReactContext = createContext<Context>({} as Context)

// TODO initialContext must be possibly partial - use immer.produce
export const NhostProvider: React.FC<{
  nhost: Nhost
}> = ({ nhost, ...props }) => {
  const interpreter = useInterpret(nhost.machine, {
    devTools: typeof window !== 'undefined' && process.env.NODE_ENV === 'development'
  })
  nhost.interpreter = interpreter
  return (
    <NhostReactContext.Provider value={nhost as Context}>
      {props.children}
    </NhostReactContext.Provider>
  )
}
