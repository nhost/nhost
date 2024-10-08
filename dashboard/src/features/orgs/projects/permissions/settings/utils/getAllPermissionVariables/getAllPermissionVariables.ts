import type { PermissionVariable } from '@/types/application';

/**
 * Extends the permission variables with system variables.
 *
 * @param permissionVariables Stored permission variables
 * @returns Stored permission variables with system variables
 */
export default function getAllPermissionVariables(
  permissionVariables?: PermissionVariable[],
): PermissionVariable[] {
  const systemVariables: PermissionVariable[] = [
    { id: 'User-Id', key: 'User-Id', value: 'id', isSystemVariable: true },
  ];

  if (!permissionVariables || !Array.isArray(permissionVariables)) {
    return systemVariables;
  }

  return [...systemVariables, ...permissionVariables];
}
