export default function formatForeignKeyColumns(referencedColumn: string) {
  const columns = referencedColumn.split(',');
  return columns.map((column) => column.trim());
}
