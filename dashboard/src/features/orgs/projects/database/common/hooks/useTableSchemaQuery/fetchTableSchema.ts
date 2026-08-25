import {
  createEmptyTableIntrospection,
  type FetchTableIntrospectionOptions,
  fetchTableIntrospection,
} from '@/features/orgs/projects/database/common/utils/fetchTableIntrospection';
import type { FetchTableReturnType } from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery';

export type FetchTableSchemaOptions = FetchTableIntrospectionOptions;

export type FetchTableSchemaReturnType = Omit<
  FetchTableReturnType,
  'rows' | 'numberOfRows'
>;

/** Fetch table columns, complete relations, and candidate-key metadata. */
export default async function fetchTableSchema(
  options: FetchTableSchemaOptions,
): Promise<FetchTableSchemaReturnType> {
  const introspection = await fetchTableIntrospection(options);

  if (introspection.kind === 'missing') {
    return {
      ...createEmptyTableIntrospection(),
      error: null,
      metadata: introspection.metadata,
    };
  }

  return { ...introspection.parsed, error: null };
}
