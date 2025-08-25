export type GeneratorOptions = {
  /**
   * Do not create a wrapper folder for the generated documentation.
   *
   * @default false
   */
  sameLevel?: boolean
  /**
   * Determines whether to skip the sidebar configuration.
   *
   * @default false
   */
  skipSidebarConfiguration?: boolean
  /**
   * Original auto-generated document.
   *
   * @default null
   */
  originalDocument?: any
}
