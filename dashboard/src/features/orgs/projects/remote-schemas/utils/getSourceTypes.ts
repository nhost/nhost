import { type IntrospectionQuery, isObjectType } from 'graphql';
import convertIntrospectionToSchema from './convertIntrospectionToSchema';

/**
 * Get the source types from the introspection data.
 * @param introspectionData - The introspection data.
 * @returns The source types in { label: string, value: string } format, without
 * introspection types (that start with `__`).
 */
export default function getSourceTypes(
  introspectionData: IntrospectionQuery | undefined,
) {
  if (!introspectionData) {
    return [];
  }

  const schema = convertIntrospectionToSchema(introspectionData);

  if (!schema) {
    return [];
  }

  const typeMap = schema.getTypeMap();

  return Object.values(typeMap)
    .filter(isObjectType)
    .filter((type) => !type.name.startsWith('__')) // Filter out introspection types
    .map((type) => ({
      label: type.name,
      value: type.name,
    }));
}
