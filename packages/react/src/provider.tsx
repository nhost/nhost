import produce from 'immer'
import React, { createContext, useEffect, useRef } from 'react'

import { Nhost, NhostContext, NhostSession } from '@nhost/core'
import { useInterpret } from '@xstate/react'

export const NhostReactContext = createContext<Nhost>({} as Nhost)

export const NhostProvider: React.FC<{
  nhost: Nhost
  initial?: NhostSession
}> = ({ nhost, initial, ...props }) => {
  const interpreter = useInterpret(nhost.machine, {
    devTools: typeof window !== 'undefined' && process.env.NODE_ENV === 'development',
    context: produce<NhostContext>(nhost.machine.context, (ctx: NhostContext) => {
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

  nhost.interpreter = interpreter
  return <NhostReactContext.Provider value={nhost}>{props.children}</NhostReactContext.Provider>
}
