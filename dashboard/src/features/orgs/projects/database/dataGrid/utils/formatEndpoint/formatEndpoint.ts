export default function formatEndpoint(
  schema: string,
  table: string,
  columnsNames: string[],
) {
  const tableName = `${schema}.${table}`;
  const formattedColumns =
    columnsNames.length > 0 ? columnsNames.join(', ') : 'Not specified';
  return `${tableName} / ${formattedColumns}`;
}
