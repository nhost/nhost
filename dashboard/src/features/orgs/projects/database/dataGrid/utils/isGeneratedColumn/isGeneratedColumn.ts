export default function isGeneratedColumn(column: {
  is_generated?: string | null;
}): boolean {
  return column.is_generated === 'ALWAYS';
}
