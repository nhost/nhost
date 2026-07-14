import { useMemo } from 'react';
import { useGetMetadata } from '@/features/orgs/projects/common/hooks/useGetMetadata';

export interface MetadataTable {
  source: string;
  schema: string;
  table: string;
}

/**
 * This hook derives the flat list of `{ source, schema, table }` entries from
 * the metadata sources, memoized.
 *
 * @returns The list of tables across all metadata sources.
 */
export default function useMetadataTables(): MetadataTable[] {
  const { data: metadata } = useGetMetadata();

  return useMemo(
    () =>
      metadata?.sources?.flatMap((source) =>
        (source.tables ?? []).map((table) => ({
          source: source.name!,
          schema: table.table.schema!,
          table: table.table.name!,
        })),
      ) ?? [],
    [metadata],
  );
}
