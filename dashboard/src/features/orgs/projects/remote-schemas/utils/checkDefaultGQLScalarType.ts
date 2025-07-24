// Check if type belongs to default gql scalar types
export default function checkDefaultGQLScalarType(typeName: string): boolean {
  const gqlDefaultTypes = ['Boolean', 'Float', 'String', 'Int', 'ID'];
  if (gqlDefaultTypes.indexOf(typeName) > -1) {
    return true;
  }
  return false;
}
