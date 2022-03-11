import { AuthContext } from '@nhost/core'

export const isBrowser = () => typeof window !== 'undefined'

export class inMemoryLocalStorage {
  private memory: Record<string, string | null>

  constructor() {
    this.memory = {}
  }

  setItem(key: string, value: string | null): void {
    this.memory[key] = value
  }
  getItem(key: string): string | null {
    return this.memory[key]
  }
  removeItem(key: string): void {
    delete this.memory[key]
  }
}

export const getSession = (context?: AuthContext) => {
  if (!context || !context.accessToken.value || !context.refreshToken.value) return null
  return {
    accessToken: context.accessToken.value,
    accessTokenExpiresIn: (context.accessToken.expiresAt.getTime() - Date.now()) / 1000,
    refreshToken: context.refreshToken.value,
    user: context.user
  }
}
