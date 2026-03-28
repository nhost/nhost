import type { RemoteFieldArgumentMappingsByPath } from '@/features/orgs/projects/database/dataGrid/types/relationships/relationships';

/**
 * Extract the LHS (left-hand side) field names from argument mappings.
 * These are the source table columns that are referenced by column-type mappings.
 */
export default function extractLhsFieldsFromMappings(
  argumentMappingsByPath: RemoteFieldArgumentMappingsByPath,
): string[] {
  const columns = new Set<string>();
  Object.values(argumentMappingsByPath).forEach((mappingsByArgument) => {
    Object.values(mappingsByArgument).forEach((mapping) => {
      if (
        mapping.enabled &&
        mapping.type === 'column' &&
        mapping.value.trim().length > 0
      ) {
        columns.add(mapping.value.trim());
      }
    });
  });

  return Array.from(columns);
}
