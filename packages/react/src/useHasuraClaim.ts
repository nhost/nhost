import { useHasuraClaims } from './useHasuraClaims'

/**
 * Use the hook `useHasuraClaim` to get the value of a specific Hasura claim of the user.
 *
 * @example
 * ```tsx
 * // if `x-hasura-company-id` exists as a custom claim
 * const companyId = useHasuraClaim('company-id')
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-hasura-claim
 */
export const useHasuraClaim = (name: string): string | string[] | null => {
  const hasuraClaims = useHasuraClaims()
  return hasuraClaims?.[name.startsWith('x-hasura-') ? name : `x-hasura-${name}`] || null
}
