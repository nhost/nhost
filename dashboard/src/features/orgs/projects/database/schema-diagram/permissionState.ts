import { findPermission } from '@/components/common/PermissionsGrid';
import type {
  DatabaseAction,
  HasuraMetadataPermission,
  HasuraMetadataTable,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  getFunctionPermissionState,
  type PermissionState,
} from '@/features/orgs/projects/database/dataGrid/utils/getFunctionPermissionState';

export const ADMIN_ROLE = 'admin';
export const PUBLIC_ROLE = 'public';

export const DATABASE_ACTIONS: readonly DatabaseAction[] = [
  'select',
  'insert',
  'update',
  'delete',
] as const;

export type PermissionDotState = 'none' | 'filled' | 'hollow';

export type RuleKey = 'filter' | 'check';

export interface PermissionRule {
  key: RuleKey;
  value: Record<string, unknown>;
}

function isEmptyConstraint(
  value: Record<string, unknown> | undefined,
): boolean {
  return !value || Object.keys(value).length === 0;
}

const RULE_KEYS_BY_ACTION: Record<DatabaseAction, readonly RuleKey[]> = {
  select: ['filter'],
  insert: ['check'],
  update: ['filter', 'check'],
  delete: ['filter'],
};

export function getRelevantRuleKeys(
  action: DatabaseAction,
): readonly RuleKey[] {
  return RULE_KEYS_BY_ACTION[action];
}

export function getRelevantRules(
  permission: HasuraMetadataPermission['permission'] | undefined,
  action: DatabaseAction,
): PermissionRule[] {
  if (!permission) {
    return [];
  }
  const rules: PermissionRule[] = [];
  for (const key of getRelevantRuleKeys(action)) {
    const value = permission[key];
    if (!isEmptyConstraint(value)) {
      rules.push({ key, value: value as Record<string, unknown> });
    }
  }
  return rules;
}

export function getTablePermissionState(
  table: HasuraMetadataTable | undefined,
  role: string,
  action: DatabaseAction,
): PermissionDotState {
  if (role === ADMIN_ROLE) {
    return 'filled';
  }

  const permission = findPermission(table, role, action);

  if (!permission) {
    return 'none';
  }

  return getRelevantRules(permission, action).length === 0
    ? 'filled'
    : 'hollow';
}

export function getColumnPermissionState(
  table: HasuraMetadataTable | undefined,
  role: string,
  action: DatabaseAction,
  columnName: string,
): PermissionDotState {
  const tableState = getTablePermissionState(table, role, action);

  if (tableState === 'none') {
    return 'none';
  }

  if (role === ADMIN_ROLE || action === 'delete') {
    return tableState;
  }

  const permission = findPermission(table, role, action);
  const allowedColumns = permission?.columns ?? [];

  if (!allowedColumns.includes(columnName)) {
    return 'none';
  }

  return tableState;
}

export function getComputedFieldPermissionState(
  table: HasuraMetadataTable | undefined,
  role: string,
  fieldName: string,
): PermissionDotState {
  const tableState = getTablePermissionState(table, role, 'select');

  if (tableState === 'none') {
    return 'none';
  }

  if (role === ADMIN_ROLE) {
    return tableState;
  }

  const permission = findPermission(table, role, 'select');
  const allowedFields = permission?.computed_fields ?? [];

  if (!allowedFields.includes(fieldName)) {
    return 'none';
  }

  return tableState;
}

export function isOperationAllowed(
  table: HasuraMetadataTable | undefined,
  role: string,
  action: DatabaseAction,
  operationKey: string,
): boolean {
  if (role === ADMIN_ROLE) {
    return true;
  }

  const permission = findPermission(table, role, action);
  if (!permission) {
    return false;
  }

  // Hasura only restricts root fields for select; insert/update/delete are
  // all-or-nothing at the action level.
  if (action !== 'select') {
    return true;
  }

  // select_aggregate also requires allow_aggregations to be true.
  if (operationKey === 'select_aggregate' && !permission.allow_aggregations) {
    return false;
  }

  const queryFields = permission.query_root_fields;
  const subscriptionFields = permission.subscription_root_fields;

  // select_stream is only a subscription root field; query_root_fields never
  // exposes it.
  const allowedAsQuery =
    operationKey === 'select_stream'
      ? false
      : queryFields == null || queryFields.includes(operationKey);
  const allowedAsSubscription =
    subscriptionFields == null || subscriptionFields.includes(operationKey);

  return allowedAsQuery || allowedAsSubscription;
}

export function tableHasAnyPermission(
  table: HasuraMetadataTable | undefined,
  role: string,
): boolean {
  if (role === ADMIN_ROLE) {
    return true;
  }

  return DATABASE_ACTIONS.some(
    (action) => getTablePermissionState(table, role, action) !== 'none',
  );
}

const FUNCTION_STATE_TO_DOT: Record<PermissionState, PermissionDotState> = {
  allowed: 'filled',
  partial: 'hollow',
  'not-allowed': 'none',
};

export interface FunctionPermissionDotInput {
  role: string;
  inferFunctionPermissions: boolean;
  isMutationFunction: boolean;
  hasSelectPermission: boolean;
  hasFunctionPermission: boolean;
}

export interface FunctionPermissionDotResult {
  state: PermissionState;
  dot: PermissionDotState;
}

export function getFunctionPermissionDotState({
  role,
  inferFunctionPermissions,
  isMutationFunction,
  hasSelectPermission,
  hasFunctionPermission,
}: FunctionPermissionDotInput): FunctionPermissionDotResult {
  const state: PermissionState =
    role === ADMIN_ROLE
      ? 'allowed'
      : getFunctionPermissionState({
          inferFunctionPermissions,
          isMutationFunction,
          hasSelectPermission,
          hasFunctionPermission,
        });

  return { state, dot: FUNCTION_STATE_TO_DOT[state] };
}
