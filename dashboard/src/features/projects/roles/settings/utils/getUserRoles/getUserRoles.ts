import type { Role } from '@/types/application';

/**
 * Convert the list of user roles that is returned by the API to a list of
 * roles that are used in the application.
 *
 * @param roles - Roles in string format
 * @returns An array of roles
 */
export default function getUserRoles(roles?: string[]): Role[] {
  if (!roles) {
    return [];
  }

  return roles.map((role) => ({
    name: role.trim(),
    isSystemRole: role === 'user' || role === 'me',
  }));
}
