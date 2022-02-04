import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import { NhostClient } from '@nhost/nhost-js'

export const AuthContext = createContext({
  user: null,
  isLoading: true,
  isAuthenticated: false
})

export function NhostAuthProvider({
  children,
  nhost
}: {
  children: ReactNode
  nhost: NhostClient
}) {
  const [authContext, setAuthContext] = useState({
    user: null,
    isLoading: true,
    isAuthenticated: false
  })

  // eslint-disable-next-line @typescript-eslint/ban-types
  let unsubscribe: Function

  const [constructorHasRun, setConstructorHasRun] = useState(false)

  // only run once
  const constructor = () => {
    if (constructorHasRun) return

    unsubscribe = nhost.auth.onAuthStateChanged((_event: any, session: any) => {
      setAuthContext({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        user: session?.user,
        isLoading: false,
        isAuthenticated: session !== null
      })
    })
    setConstructorHasRun(true)
  }

  constructor()

  useEffect(() => () => {
    try {
      unsubscribe()
      // eslint-disable-next-line no-empty
    } catch {}
  })

  return <AuthContext.Provider value={authContext}>{children}</AuthContext.Provider>
}

export function useNhostAuth() {
  return useContext(AuthContext)
}
