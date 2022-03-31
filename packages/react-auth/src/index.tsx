import { createContext } from 'react'

import type { User } from '@nhost/hasura-auth-js'
import { NhostReactProvider, useNhostAuth } from '@nhost/react'

type NhostContext = {
  isLoading: boolean
  isAuthenticated: boolean
  user: User | null
}
export const AuthContext = createContext<NhostContext>({
  user: null,
  isLoading: true,
  isAuthenticated: false
})

export { NhostReactProvider as NhostAuthProvider }

export { useNhostAuth }
