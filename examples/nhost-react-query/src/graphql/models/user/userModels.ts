export interface UserAccount {
  email: string
}

export interface User {
  id: string
  displayName: string
  account: UserAccount
  avatarUrl: string | null
}
