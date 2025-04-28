import { proxy } from 'valtio'

export type AppState = {
  /**
   * Identifiers and types of available types. Used to easily query the type of a given identifier.
   *
   * @default new Map()
   */
  contentReferences: Map<number, string>
  /**
   * Generated documentation path relative to Docusaurus root.
   */
  docsRoot: string
  /**
   * `true` if the app is in verbose mode, `false` otherwise.
   *
   * @default false
   */
  verbose?: boolean
  /**
   * Name of Docusaurus sidebar configuration.
   */
  sidebarConfig?: string
  /**
   * Base slug to use for generating documentation links.
   */
  baseSlug?: string
  /**
   * Base edit url that will be used to render the `custom_edit_url` front matter property
   * It will be appended with `/<file name of the first source>#L<line number of the first source>
   * @example https://github.com/nhost/nhost/edit/main/packages
   * @see {@link https://docusaurus.io/fr/docs/api/plugins/@docusaurus/plugin-content-docs#custom_edit_url}
   */
  baseEditUrl?: string

  /**
   * Generated documentation path relative to Docusaurus root. Leading and trailing slashes are
   * removed.
   */
  formattedDocsRoot: string
}

export const appState = proxy<AppState>({
  verbose: false,
  contentReferences: new Map(),
  docsRoot: '',
  get formattedDocsRoot() {
    return this.docsRoot.replace(/(^\/|\/$)/gi, '')
  }
})

export default appState
