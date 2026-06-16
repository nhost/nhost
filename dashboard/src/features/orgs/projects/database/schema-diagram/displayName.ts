import type { NamingMode } from './useSchemaGraph';

export const GRAPHQL_NAME_CLASS = 'text-purple-600 dark:text-purple-400';

export function resolveDisplayName(
  postgresName: string,
  graphqlName: string | undefined,
  namingMode: NamingMode,
): { name: string; isCustomGraphql: boolean } {
  if (
    namingMode === 'graphql' &&
    graphqlName !== undefined &&
    graphqlName !== postgresName
  ) {
    return { name: graphqlName, isCustomGraphql: true };
  }
  return { name: postgresName, isCustomGraphql: false };
}
