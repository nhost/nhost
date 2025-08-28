function isStandardGraphQLScalar(typeName: string): boolean {
  const builtIns = new Set(['Boolean', 'Float', 'String', 'Int', 'ID']);
  return builtIns.has(typeName);
}

export default isStandardGraphQLScalar;
