import type {
  DatabaseAction,
  DatabaseObjectType,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

const ALL_ACTIONS: DatabaseAction[] = ['insert', 'select', 'update', 'delete'];
const SELECT_ONLY: DatabaseAction[] = ['select'];

/**
 * Determines which permission actions to show based on the object type and
 * the pg_relation_is_updatable bitmask (with include_triggers=true).
 * Bitmask values: 8 = insertable, 4 = updatable, 16 = deletable.
 */
export default function getAllowedActions(
  objectType?: DatabaseObjectType,
  updatability?: number,
): DatabaseAction[] {
  if (objectType === 'ORDINARY TABLE' || objectType === 'FOREIGN TABLE') {
    return ALL_ACTIONS;
  }

  if (updatability == null) {
    return objectType === 'MATERIALIZED VIEW' ? SELECT_ONLY : ALL_ACTIONS;
  }

  const actions: DatabaseAction[] = [];
  if (updatability & 8) {
    actions.push('insert');
  }
  actions.push('select');
  if (updatability & 4) {
    actions.push('update');
  }
  if (updatability & 16) {
    actions.push('delete');
  }
  return actions;
}
