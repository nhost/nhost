export default function formatEndpoint(
  schemaName: string | undefined,
  name: string | undefined,
  columns: string[],
) {
  const qualifiedTable = `${schemaName ?? 'public'}.${name ?? 'unknown_table'}`;
  const formattedColumns =
    columns.length > 0 ? columns.join(', ') : 'Not specified';

  return `${qualifiedTable} / ${formattedColumns}`;
}
