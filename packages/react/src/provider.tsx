import { AuthContext, NhostSession } from '@nhost/nhost-js'
import { useInterpret } from '@xstate/react'
import produce from 'immer'
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
  const machine = nhost.auth.client.machine
  const interpreter = useInterpret(machine, {
    devTools: nhost.devTools,
    context: produce<AuthContext>(machine.context, (ctx: AuthContext) => {
      if (initial) {
        ctx.user = initial.user
        ctx.refreshToken.value = initial.refreshToken ?? null
        ctx.accessToken.value = initial.accessToken ?? null
        ctx.accessToken.expiresAt = new Date(Date.now() + initial.accessTokenExpiresIn * 1_000)
      }
    })
  }).start()

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

  nhost.auth.client.interpreter = interpreter
  return <NhostReactContext.Provider value={nhost}>{props.children}</NhostReactContext.Provider>
}

/**
 * @deprecated use `NhostProvider` instead
 */
export const NhostReactProvider = NhostProvider
