import { NhostSession } from '@nhost/nhost-js'
import { useInterpret } from '@xstate/react'
import React, { createContext, PropsWithChildren, useEffect, useRef } from 'react'
import { NhostClient } from './client'
export const NhostReactContext = createContext<NhostClient>({} as NhostClient)
export interface NhostProviderProps {
  nhost: NhostClient
  initial?: NhostSession
}

export const NhostProvider: React.FC<PropsWithChildren<NhostProviderProps>> = ({
  nhost,
  initial,
  ...props
}) => {
  const interpreter = useInterpret(nhost.auth.client.machine, { devTools: nhost.devTools })

  nhost.auth.client.start({ interpreter, initialSession: initial, devTools: nhost.devTools })

  // * Hook to send session update everytime the 'initial' props changed
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
    } else {
      if (initial) {
        interpreter.send('SESSION_UPDATE', { data: { session: initial } })
      }
    }
  }, [initial, interpreter])

  return <NhostReactContext.Provider value={nhost}>{props.children}</NhostReactContext.Provider>
}

/**
 * @deprecated use `NhostProvider` instead
 */
export const NhostReactProvider = NhostProvider
