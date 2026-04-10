export type PermissionState = 'allowed' | 'partial' | 'not-allowed';

export interface GetFunctionPermissionStateParams {
  inferFunctionPermissions: boolean;
  isMutationFunction: boolean;
  hasSelectPermission: boolean;
  hasFunctionPermission: boolean;
}

export default function getFunctionPermissionState({
  inferFunctionPermissions,
  isMutationFunction,
  hasSelectPermission,
  hasFunctionPermission,
}: GetFunctionPermissionStateParams): PermissionState {
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
