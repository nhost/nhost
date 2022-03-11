import produce from 'immer'
import React, { createContext, useEffect, useRef } from 'react'

import { AuthContext, NhostSession } from '@nhost/core'
import { NhostClient } from '@nhost/nhost-js'
import { useInterpret } from '@xstate/react'

export const NhostReactContext = createContext<NhostClient>({} as NhostClient)

// TODO create a NhostClient in @nhost/react that uses {start: false} as an option
export const NhostProvider: React.FC<{
  nhost: NhostClient
  initial?: NhostSession
}> = ({ nhost, initial, ...props }) => {
  const machine = nhost.auth.client.machine
  const interpreter = useInterpret(machine, {
    devTools: typeof window !== 'undefined' && process.env.NODE_ENV === 'development',
    context: produce<AuthContext>(machine.context, (ctx: AuthContext) => {
      if (initial) {
        ctx.user = initial.user
        ctx.refreshToken.value = initial.refreshToken ?? null
        ctx.accessToken.value = initial.accessToken ?? null
        ctx.accessToken.expiresAt = new Date(Date.now() + initial.accessTokenExpiresIn * 1_000)
      }
    })
  })

  // * Hook to send session update everytime the 'initial' props changed
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
    } else {
      if (initial) {
        interpreter.send({ type: 'SESSION_UPDATE', data: { session: initial } })
      }
    }
  }, [initial, interpreter])

  nhost.auth.client.interpreter = interpreter
  return <NhostReactContext.Provider value={nhost}>{props.children}</NhostReactContext.Provider>
}
