import type { CustomClaim } from '@/types/application';

/**
 * Converts an array containing permission variables to an array of permission
 * variables.
 *
 * @param customClaims An object containing permission variables
 * @returns An array of permission variables
 */
export default function getPermissionVariablesObject(
  customClaims?: CustomClaim[],
) {
  return (
    customClaims?.reduce(
      (accumulator, { key: variableKey, value: variableValue }) => ({
        ...accumulator,
        [variableKey]: variableValue,
      }),
      {},
    ) || {}
  );
}
