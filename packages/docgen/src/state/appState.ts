import { proxy } from 'valtio/vanilla'

export type AppState = {
  /**
   * `true` if the app is in verbose mode, `false` otherwise.
   *
   * @default false
   */
  verbose: boolean
  /**
   * Identifiers and types of available types. Used to easily query the type of a given identifier.
   *
   * @default new Map()
   */
  contentReferences: Map<number, string>
  /**
   * Root path relative to Docusaurus root.
   */
  docsRoot?: string
}

export const appState = proxy<AppState>({ verbose: false, contentReferences: new Map() })

export default appState
