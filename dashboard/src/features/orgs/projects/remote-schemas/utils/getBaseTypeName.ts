export default function getBaseTypeName(value: string): string {
  const typeName = value.replace(/[[\]!]+/g, '');
  return typeName;
}
