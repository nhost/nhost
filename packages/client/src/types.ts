// TODO create a dedicated package for types
// TODO import generated typings from 'hasura-auth'

export type User = {
  id: string
  createdAt: string
  displayName: string
  avatarUrl: string
  locale: string
  email?: string
  isAnonymous: boolean
  defaultRole: string
  roles: string[]
  metadata: Record<string, unknown>
}

// ! copy-paste from hasura-auth
export type NhostSession = {
  accessToken: string
  accessTokenExpiresIn: number
  refreshToken: string
  user: User
}
