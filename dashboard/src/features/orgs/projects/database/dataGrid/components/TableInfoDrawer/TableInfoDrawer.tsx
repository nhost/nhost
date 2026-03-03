import TableObjectsSection from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm/TableObjectsSection';

export interface TableInfoDrawerProps {
  schema: string;
  tableName: string;
}

export default function TableInfoDrawer({
  schema,
  tableName,
}: TableInfoDrawerProps) {
  return <TableObjectsSection schema={schema} table={tableName} />;
}
