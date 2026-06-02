import type { NamingMode } from './useSchemaGraph';

/** Tailwind classes used to highlight a custom GraphQL name (table, column,
 * computed field or function). */
export const GRAPHQL_NAME_CLASS = 'text-purple-600 dark:text-purple-400';

/**
 * Resolves which name a node/field should display for the active naming mode.
 * In GraphQL mode a custom GraphQL name takes precedence (and is flagged so the
 * caller can style it); otherwise the Postgres name is used.
 */
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
