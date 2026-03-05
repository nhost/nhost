import type {
  DatabaseObjectType,
  DatabaseObjectViewModel,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

export default function sortDatabaseObjects(
  objects: DatabaseObjectViewModel[],
  enumTablePaths?: Set<string>,
): DatabaseObjectViewModel[] {
  return [...objects].sort((a, b) => {
    const typeOrder: Record<DatabaseObjectType, number> = {
      'ORDINARY TABLE': 0,
      'FOREIGN TABLE': 2,
      'MATERIALIZED VIEW': 3,
      VIEW: 4,
    };

    const getOrder = (obj: DatabaseObjectViewModel) => {
      const tablePath = `${obj.schema}.${obj.name}`;
      if (enumTablePaths?.has(tablePath)) {
        return 1;
      }
      return typeOrder[obj.objectType] ?? 99;
    };

    const orderA = getOrder(a);
    const orderB = getOrder(b);

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    return a.name.localeCompare(b.name);
  });
}
