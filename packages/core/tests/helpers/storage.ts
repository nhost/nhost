/**
 * Custom in memory storage implementation for testing purposes.
 */
export const customStorage = {
  map: new Map<string, any>(),
  getItem(key: string) {
    return this.map.get(key)
  },
  removeItem(key: string) {
    return this.map.delete(key)
  },
  setItem(key: string, value: any) {
    return this.map.set(key, value)
  },
  clear() {
    return this.map.clear()
  }
}

export default customStorage
