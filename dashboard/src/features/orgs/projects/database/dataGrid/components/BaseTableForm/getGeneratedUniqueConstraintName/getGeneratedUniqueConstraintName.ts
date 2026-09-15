export default function getGeneratedUniqueConstraintName(
  tableName: string,
  columnNames: string[],
) {
  const identifier = [tableName, ...columnNames].filter(Boolean).join('_');

  return `${identifier || 'unique'}_key`;
}
