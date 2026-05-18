import { findPermission } from '@/components/common/PermissionsGrid';
import type {
  DatabaseAction,
  HasuraMetadataPermission,
  HasuraMetadataTable,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

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
