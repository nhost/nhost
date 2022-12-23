import type { CustomClaim } from '@/types/application';

/**
 * Converts an object containing permission variables to an array of permission
 * variables.
 *
 * @param customClaims An object containing permission variables
 * @returns An array of permission variables
 */
export default function getPermissionVariablesArray(
  customClaims?: Record<string, any>,
): CustomClaim[] {
  const systemClaims: CustomClaim[] = [
    { key: 'User-Id', value: 'id', isSystemClaim: true },
  ];

  if (!customClaims) {
    return systemClaims;
  }

  return systemClaims.concat(
    Object.keys(customClaims)
      .sort()
      .map((key) => ({
        key,
        value: customClaims[key],
      })),
  );
}
