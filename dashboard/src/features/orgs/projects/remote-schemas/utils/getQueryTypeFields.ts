import { type IntrospectionQuery } from 'graphql';
import convertIntrospectionToSchema from './convertIntrospectionToSchema';

/**
 * Get the query type fields from the introspection data.
 * @param introspectionData - The introspection data.
 * @returns The query type fields in { label: string, value: string } format.
 */
export default function getQueryTypeFields(
  introspectionData: IntrospectionQuery | undefined,
) {
  if (!introspectionData) {
    return [];
  }

  const schema = convertIntrospectionToSchema(introspectionData);
  if (!schema) {
    return [];
  }

  const queryType = schema.getQueryType();

  if (!queryType) {
    return [];
  }

  const fields = queryType.getFields();

  return Object.keys(fields).map((fieldName) => ({
    label: fieldName,
    value: fieldName,
  }));
}
