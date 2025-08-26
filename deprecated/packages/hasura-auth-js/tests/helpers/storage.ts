import { ClientStorage } from '../../src'

/**
 * Custom in memory storage implementation for testing purposes.
 */
export class CustomClientStorage implements ClientStorage {
  private _storage: Map<string, any>

  constructor(storage: Map<string, any>) {
    this._storage = storage
  }

  public getItem = (key: string) => this._storage.get(key)
  public setItem = (key: string, value: any) => this._storage.set(key, value)
  public removeItem = (key: string) => this._storage.delete(key)
  public clear = () => this._storage.clear()
}

export default CustomClientStorage
