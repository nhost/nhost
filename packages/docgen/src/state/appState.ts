import { proxy } from 'valtio/vanilla'

export type AppState = {
  verbose: boolean
  contentReferences: Map<number, string>
}

export const appState = proxy<AppState>({ verbose: false, contentReferences: new Map() })

export default appState
