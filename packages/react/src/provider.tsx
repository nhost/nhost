import { AuthContext, NhostSession } from '@nhost/core'
import { NhostClient } from '@nhost/nhost-js'
import { useInterpret } from '@xstate/react'
import produce from 'immer'
import React, { createContext, PropsWithChildren, useEffect, useRef } from 'react'

export const NhostReactContext = createContext<NhostClient>({} as NhostClient)
export interface NhostReactProviderProps {
  nhost: NhostClient
  initial?: NhostSession
}

export const NhostReactProvider: React.FC<PropsWithChildren<NhostReactProviderProps>> = ({
  nhost,
  initial,
  ...props
}) => {
  const machine = nhost.auth.client.machine

  const context =
    initial &&
    produce<AuthContext>(machine.context, (ctx: AuthContext) => {
      ctx.user = initial.user
      ctx.refreshToken.value = initial.refreshToken ?? null
      ctx.accessToken.value = initial.accessToken ?? null
      ctx.accessToken.expiresAt = new Date(Date.now() + initial.accessTokenExpiresIn * 1_000)
    })

  const interpreter = useInterpret(machine, {
    devTools: nhost.devTools,
    context
  })

  nhost.auth.client.start({ interpreter, context: initial && context, devTools: nhost.devTools })

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
