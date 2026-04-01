export type PermissionState = 'allowed' | 'partial' | 'not-allowed';

export interface GetPermissionStateParams {
  inferFunctionPermissions: boolean;
  isMutationFunction: boolean;
  hasSelectPermission: boolean;
  hasFunctionPermission: boolean;
}

export function getPermissionState({
  inferFunctionPermissions,
  isMutationFunction,
  hasSelectPermission,
  hasFunctionPermission,
}: GetPermissionStateParams): PermissionState {
  if (inferFunctionPermissions && !isMutationFunction) {
    return hasSelectPermission ? 'allowed' : 'not-allowed';
  }

  if (hasFunctionPermission && hasSelectPermission) {
    return 'allowed';
  }
  if (hasFunctionPermission && !hasSelectPermission) {
    return 'partial';
  }
  return 'not-allowed';
}
