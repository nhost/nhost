/**
 * Adds the admin and public roles to the given list of roles with duplicates
 *
 * @param roles - Roles from auth.roles table in string format
 * @returns An array with the admin roles
 */
export default function getAdminRoles(roles?: string[]) {
  if (!roles) {
    return ['admin', 'public'];
  }

  const rolesSet = new Set(['admin', 'public', ...roles]);

  return Array.from(rolesSet);
}
