// TODO create a dedicated package for types

import { NhostClientOptions } from './client'

// ! copy-paste from hasura-auth
export type NhostSession = {
  accessToken: string
  accessTokenExpiresIn: number
  refreshToken: string
  user?: {
    id: string
    createdAt: string
    displayName: string
    avararUrl: string
    locale: string
    email: string
    isAnonymous: boolean
    defaultRole: string
    roles: string[]
  }
}
