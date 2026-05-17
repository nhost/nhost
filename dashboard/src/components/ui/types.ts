/**
 * Option type for Autocomplete components.
 */
export interface AutocompleteOption<TValue = string> {
  /**
   * Label to display.
   */
  label: string
  /**
   * Label to display in the dropdown.
   */
  dropdownLabel?: string
  /**
   * Value to be submitted.
   */
  value: TValue
  /**
   * Determines whether the option is custom.
   */
  custom?: boolean
  /**
   * Value that can be used to group options.
   */
  group?: string
  /**
   * Any additional data to be passed to the option.
   */
  // biome-ignore lint/suspicious/noExplicitAny: TODO
  metadata?: any
}
