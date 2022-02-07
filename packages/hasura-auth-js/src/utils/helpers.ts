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
