import type { DatabaseObjectViewModel } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

export default function sortDatabaseObjects(
  objects: DatabaseObjectViewModel[],
): DatabaseObjectViewModel[] {
  return [...objects].sort((a, b) => a.name.localeCompare(b.name));
}
