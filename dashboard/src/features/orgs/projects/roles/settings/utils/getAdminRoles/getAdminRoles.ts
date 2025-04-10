import { isEmptyValue } from '@/lib/utils';

/**
 * Adds the admin public and anonymous roles to the given list of roles with duplicates
 *
 * @param roles - Roles from auth.roles table in string format
 * @returns An array with the admin roles
 */
export default function getAdminRoles(roles?: string[]) {
  if (isEmptyValue(roles)) {
    return ['admin', 'public', 'anonymous'];
  }

  const rolesSet = new Set(['admin', 'public', 'anonymous', ...roles]);

  return Array.from(rolesSet);
}
